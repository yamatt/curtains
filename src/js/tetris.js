import Bluetooth from "./ble.js";

// Device hue range: the LED color byte maps hue 0-360° onto 0-180
const DEVICE_HUE_RANGE = 180;

// Tetromino definitions: each piece is a list of [col, row] offsets from spawn position.
// Coordinates are in Tetris-cell space (10 wide × 20 tall).
const PIECES = [
  // I
  { shape: [[0, 0], [1, 0], [2, 0], [3, 0]], color: Bluetooth.PixelColors.BLUE },
  // O
  { shape: [[0, 0], [1, 0], [0, 1], [1, 1]], color: Bluetooth.PixelColors.YELLOW },
  // T
  { shape: [[1, 0], [0, 1], [1, 1], [2, 1]], color: Bluetooth.PixelColors.PURPLE },
  // S
  { shape: [[1, 0], [2, 0], [0, 1], [1, 1]], color: Bluetooth.PixelColors.GREEN },
  // Z
  { shape: [[0, 0], [1, 0], [1, 1], [2, 1]], color: Bluetooth.PixelColors.RED },
  // L
  { shape: [[2, 0], [0, 1], [1, 1], [2, 1]], color: Bluetooth.PixelColors.ORANGE },
  // J
  { shape: [[0, 0], [0, 1], [1, 1], [2, 1]], color: Bluetooth.PixelColors.WHITE },
];

// Line-clear score multipliers (index = number of lines cleared at once)
const LINE_SCORES = [0, 100, 300, 500, 800];

export default class TetrisGame {
  constructor() {
    this.bluetooth = new Bluetooth();

    this.GRID_W = 20;        // LED display width in pixels
    this.GRID_H = 20;        // LED display height in pixels
    this.TETRIS_W = 10;      // Tetris play-field width in cells (each cell = 1 LED pixel wide)
    this.TETRIS_H = 20;      // Tetris play-field height in cells (each cell = 1 LED pixel tall)
    this.TETRIS_OFFSET = 5;  // Horizontal LED pixel offset to centre the 10-cell play-field in the 20-pixel display

    // Game state
    this.board = this.emptyBoard();       // 1 where a placed cell exists, 0 elsewhere
    this.boardColors = this.emptyBoard(); // stores LED color byte for each placed cell

    this.currentShape = null;  // Array of [col, row] offsets
    this.currentPos = { x: 0, y: 0 };
    this.currentColor = 0;

    this.score = 0;
    this.lines = 0;
    this.level = 1;

    this.isRunning = false;
    this.gameLoopId = null;

    // Canvas preview
    this.canvas = null;
    this.ctx = null;

    // BLE pixel queue and state
    this.pixelQueue = [];
    this.isWriting = false;
    this.prevPixels = new Map();
  }

  // ── Board helpers ─────────────────────────────────────────────────────────

  emptyBoard() {
    return Array.from({ length: this.TETRIS_H }, () => new Array(this.TETRIS_W).fill(0));
  }

  get tickInterval() {
    return Math.max(100, 600 - (this.level - 1) * 50);
  }

  // ── Piece management ──────────────────────────────────────────────────────

  spawnPiece() {
    const template = PIECES[Math.floor(Math.random() * PIECES.length)];
    this.currentShape = template.shape.map(([c, r]) => [c, r]);
    this.currentColor = template.color;
    this.currentPos = { x: Math.floor(this.TETRIS_W / 2) - 2, y: 0 };

    if (!this.isValidPosition(this.currentShape, this.currentPos)) {
      // Board has reached the top — game over
      this.stopGame();
      this.showStatus(`Game Over! Final score: ${this.score}`, "error");
    }
  }

  isValidPosition(shape, pos) {
    for (const [dc, dr] of shape) {
      const col = pos.x + dc;
      const row = pos.y + dr;
      if (col < 0 || col >= this.TETRIS_W || row < 0 || row >= this.TETRIS_H) return false;
      if (this.board[row][col]) return false;
    }
    return true;
  }

  placePiece() {
    for (const [dc, dr] of this.currentShape) {
      const col = this.currentPos.x + dc;
      const row = this.currentPos.y + dr;
      if (row >= 0 && row < this.TETRIS_H && col >= 0 && col < this.TETRIS_W) {
        this.board[row][col] = 1;
        this.boardColors[row][col] = this.currentColor;
      }
    }
    this.clearLines();
    this.spawnPiece();
  }

  clearLines() {
    let linesCleared = 0;
    for (let row = this.TETRIS_H - 1; row >= 0; row--) {
      if (this.board[row].every(cell => cell)) {
        this.board.splice(row, 1);
        this.boardColors.splice(row, 1);
        this.board.unshift(new Array(this.TETRIS_W).fill(0));
        this.boardColors.unshift(new Array(this.TETRIS_W).fill(0));
        linesCleared++;
        row++; // recheck the same row index after the splice
      }
    }

    if (linesCleared > 0) {
      const oldLevel = this.level;
      this.score += (LINE_SCORES[linesCleared] ?? LINE_SCORES[4]) * this.level;
      this.lines += linesCleared;
      this.level = Math.floor(this.lines / 10) + 1;
      this.updateScore();

      // Restart the tick interval if level increased (game speeds up)
      if (this.level !== oldLevel && this.isRunning) {
        clearInterval(this.gameLoopId);
        this.gameLoopId = setInterval(() => this.tick(), this.tickInterval);
      }
    }
  }

  // ── Piece movement ────────────────────────────────────────────────────────

  rotatePiece() {
    // 90° clockwise: (c, r) → (maxRow − r, c)
    const maxRow = Math.max(...this.currentShape.map(([, r]) => r));
    const rotated = this.currentShape.map(([c, r]) => [maxRow - r, c]);

    if (this.isValidPosition(rotated, this.currentPos)) {
      this.currentShape = rotated;
      return;
    }
    // Wall-kick: try small horizontal shifts to fit the rotated piece
    for (const kick of [1, -1, 2, -2]) {
      const kicked = { x: this.currentPos.x + kick, y: this.currentPos.y };
      if (this.isValidPosition(rotated, kicked)) {
        this.currentShape = rotated;
        this.currentPos = kicked;
        return;
      }
    }
    // Rotation not possible — ignore
  }

  moveLeft() {
    const newPos = { x: this.currentPos.x - 1, y: this.currentPos.y };
    if (this.isValidPosition(this.currentShape, newPos)) {
      this.currentPos = newPos;
    }
  }

  moveRight() {
    const newPos = { x: this.currentPos.x + 1, y: this.currentPos.y };
    if (this.isValidPosition(this.currentShape, newPos)) {
      this.currentPos = newPos;
    }
  }

  /** Move piece down one row. Returns true if successful, false if it was placed. */
  moveDown() {
    const newPos = { x: this.currentPos.x, y: this.currentPos.y + 1 };
    if (this.isValidPosition(this.currentShape, newPos)) {
      this.currentPos = newPos;
      return true;
    }
    this.placePiece();
    return false;
  }

  /** Drop the piece instantly to the lowest valid position. */
  hardDrop() {
    while (this.moveDown()) { /* keep dropping */ }
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  init() {
    this.canvas = document.getElementById("preview-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    document.getElementById("connect-btn").addEventListener("click", () => this.handleConnect());
    document.getElementById("disconnect-btn").addEventListener("click", () => this.handleDisconnect());
    document.getElementById("start-btn").addEventListener("click", () => this.startGame());
    document.getElementById("stop-btn").addEventListener("click", () => this.stopGame());

    document.getElementById("btn-left").addEventListener("click", () => {
      if (this.isRunning) { this.moveLeft(); this.drawPreview(); }
    });
    document.getElementById("btn-rotate").addEventListener("click", () => {
      if (this.isRunning) { this.rotatePiece(); this.drawPreview(); }
    });
    document.getElementById("btn-right").addEventListener("click", () => {
      if (this.isRunning) { this.moveRight(); this.drawPreview(); }
    });
    document.getElementById("btn-down").addEventListener("click", () => {
      if (this.isRunning) { this.moveDown(); this.drawPreview(); }
    });
    document.getElementById("btn-drop").addEventListener("click", () => {
      if (this.isRunning) { this.hardDrop(); this.drawPreview(); }
    });

    // Keyboard controls
    document.addEventListener("keydown", (e) => {
      if (!this.isRunning) return;
      switch (e.key) {
        case "ArrowLeft":  this.moveLeft();    break;
        case "ArrowRight": this.moveRight();   break;
        case "ArrowUp":    this.rotatePiece(); break;
        case "ArrowDown":  this.moveDown();    break;
        case " ":          this.hardDrop();    break;
        default: return;
      }
      e.preventDefault();
      this.drawPreview();
    });

    this.drawPreview();
    this.showStatus("Connect to device and tap Start to play!", "info");
  }

  startGame() {
    if (this.isRunning) return;
    this.board = this.emptyBoard();
    this.boardColors = this.emptyBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.updateScore();
    this.spawnPiece();
    this.isRunning = true;
    this.gameLoopId = setInterval(() => this.tick(), this.tickInterval);
    document.getElementById("start-btn").disabled = true;
    document.getElementById("stop-btn").disabled = false;
    this.showStatus("Game running! Use buttons or arrow keys to play.", "success");
  }

  stopGame() {
    this.isRunning = false;
    if (this.gameLoopId) {
      clearInterval(this.gameLoopId);
      this.gameLoopId = null;
    }
    document.getElementById("start-btn").disabled = false;
    document.getElementById("stop-btn").disabled = true;
    this.pixelQueue = [];
    this.showStatus("Game stopped.", "info");
  }

  tick() {
    this.moveDown();
    this.drawPreview();
    if (this.bluetooth.isConnected() && this.pixelQueue.length < 30) {
      this.queueLEDUpdate();
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Map Tetris cell (tc, tr) to LED pixels.
   * Each Tetris column occupies 1 LED pixel; the 10-cell play-field is centred
   * within the 20-pixel display using TETRIS_OFFSET pixels of padding on each side.
   * Dotted white border lines are drawn one pixel outside the play-field edges.
   */
  getGamePixels() {
    const pixels = new Map();
    const offset = this.TETRIS_OFFSET;

    // Dotted white border lines along the sides of the play-field (every other row)
    const leftBorder = offset - 1;
    const rightBorder = offset + this.TETRIS_W;
    for (let row = 0; row < this.TETRIS_H; row++) {
      if (row % 2 === 0) {
        pixels.set(`${leftBorder},${row}`, Bluetooth.PixelColors.WHITE);
        pixels.set(`${rightBorder},${row}`, Bluetooth.PixelColors.WHITE);
      }
    }

    // Placed board cells
    for (let row = 0; row < this.TETRIS_H; row++) {
      for (let col = 0; col < this.TETRIS_W; col++) {
        if (this.board[row][col]) {
          const ledX = col + offset;
          const color = this.boardColors[row][col];
          pixels.set(`${ledX},${row}`, color);
        }
      }
    }

    // Falling piece
    if (this.currentShape) {
      for (const [dc, dr] of this.currentShape) {
        const col = this.currentPos.x + dc;
        const row = this.currentPos.y + dr;
        if (col >= 0 && col < this.TETRIS_W && row >= 0 && row < this.TETRIS_H) {
          const ledX = col + offset;
          pixels.set(`${ledX},${row}`, this.currentColor);
        }
      }
    }

    return pixels;
  }

  colorByteToCSS(colorByte) {
    switch (colorByte) {
      case Bluetooth.PixelColors.WHITE:  return "#FFFFFF";
      case Bluetooth.PixelColors.OFF:    return "#000000";
      case Bluetooth.PixelColors.GREEN:  return "#00CC00";
      case Bluetooth.PixelColors.RED:    return "#CC0000";
      case Bluetooth.PixelColors.BLUE:   return "#0044CC";
      case Bluetooth.PixelColors.YELLOW: return "#CCCC00";
      case Bluetooth.PixelColors.ORANGE: return "#CC6600";
      case Bluetooth.PixelColors.PURPLE: return "#8800CC";
      default: {
        const hue = (colorByte / DEVICE_HUE_RANGE) * 360;
        return `hsl(${hue}, 100%, 50%)`;
      }
    }
  }

  drawPreview() {
    const pixels = this.getGamePixels();
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cellW = w / this.GRID_W;
    const cellH = h / this.GRID_H;

    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, w, h);

    pixels.forEach((colorByte, key) => {
      const [x, y] = key.split(",").map(Number);
      this.ctx.fillStyle = this.colorByteToCSS(colorByte);
      this.ctx.fillRect(
        Math.round(x * cellW),
        Math.round(y * cellH),
        Math.ceil(cellW),
        Math.ceil(cellH)
      );
    });
  }

  // ── BLE pixel updates ─────────────────────────────────────────────────────

  queueLEDUpdate() {
    const newPixels = this.getGamePixels();

    // Turn off pixels that are no longer lit
    this.prevPixels.forEach((colorByte, key) => {
      if (!newPixels.has(key)) {
        const [x, y] = key.split(",").map(Number);
        this.pixelQueue.push({ x, y, colorByte: Bluetooth.PixelColors.OFF });
      }
    });

    // Set pixels that are new or changed
    newPixels.forEach((colorByte, key) => {
      if (this.prevPixels.get(key) !== colorByte) {
        const [x, y] = key.split(",").map(Number);
        this.pixelQueue.push({ x, y, colorByte });
      }
    });

    this.prevPixels = newPixels;

    if (!this.isWriting) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isWriting) return;
    this.isWriting = true;
    while (this.pixelQueue.length > 0 && this.bluetooth.isConnected()) {
      const update = this.pixelQueue.shift();
      try {
        await this.bluetooth.setPixel(update.x, update.y, update.colorByte);
      } catch (err) {
        this.showStatus(`BLE write error: ${err.message}`, "error");
        break;
      }
    }
    this.isWriting = false;
  }

  async sendInitialFrame() {
    if (!this.bluetooth.isConnected()) return;
    try {
      await this.bluetooth.clearPixels();
    } catch (err) {
      this.showStatus(`Failed to clear display: ${err.message}`, "error");
    }
    const pixels = this.getGamePixels();
    pixels.forEach((colorByte, key) => {
      const [x, y] = key.split(",").map(Number);
      this.pixelQueue.push({ x, y, colorByte });
    });
    this.prevPixels = pixels;
    this.processQueue();
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  updateScore() {
    document.getElementById("score").textContent = this.score;
    document.getElementById("lines").textContent = this.lines;
    document.getElementById("level").textContent = this.level;
  }

  async handleConnect() {
    const deviceName = document.getElementById("device-name").value;
    const charUuid = document.getElementById("char-uuid").value;

    if (!charUuid) {
      this.showStatus("Please enter a characteristic UUID.", "error");
      return;
    }

    this.showStatus("Connecting...", "info");
    try {
      await this.bluetooth.connect(deviceName || "");
      this.bluetooth.setCharacteristic(charUuid);
      await this.bluetooth.enterDrawMode();
      await this.sendInitialFrame();
      this.showStatus("Connected! Tap Start to play.", "success");
    } catch (err) {
      this.showStatus(`Connection failed: ${err.message}`, "error");
    }
  }

  async handleDisconnect() {
    this.stopGame();
    this.bluetooth.disconnect();
    this.prevPixels = new Map();
    this.pixelQueue = [];
    this.showStatus("Disconnected.", "info");
  }

  showStatus(message, type = "info") {
    const el = document.getElementById("status");
    el.textContent = message;
    el.className = `status ${type}`;
  }
}
