import Bluetooth from "./ble.js";

// Device hue range: the LED color byte maps hue 0-360° onto 0-180
const DEVICE_HUE_RANGE = 180;

// Brick color per row (top to bottom)
const BRICK_ROW_COLORS = [
  Bluetooth.PixelColors.RED,
  Bluetooth.PixelColors.ORANGE,
  Bluetooth.PixelColors.YELLOW,
  Bluetooth.PixelColors.GREEN,
  Bluetooth.PixelColors.BLUE,
];

export default class BreakoutGame {
  constructor() {
    this.bluetooth = new Bluetooth();

    this.GRID_W = 20;
    this.GRID_H = 20;
    this.PADDLE_W = 4;
    this.PADDLE_Y = 18;
    this.BRICK_ROWS = 5;
    this.BRICK_START_ROW = 1;

    // Game state (float positions for smooth movement)
    this.paddleX = 8;
    this.ball = { x: 10.0, y: 14.0 };
    this.ballVel = { x: 0.3, y: -0.4 };
    this.bricks = [];
    this.score = 0;
    this.lives = 3;

    this.isRunning = false;
    this.gameLoopId = null;

    // Canvas preview
    this.canvas = null;
    this.ctx = null;

    // BLE pixel queue and state
    this.pixelQueue = [];
    this.isWriting = false;
    this.prevPixels = new Map();

    this.initBricks();
  }

  initBricks() {
    this.bricks = [];
    for (let row = 0; row < this.BRICK_ROWS; row++) {
      for (let col = 0; col < this.GRID_W; col++) {
        this.bricks.push({
          x: col,
          y: this.BRICK_START_ROW + row,
          alive: true,
          color: BRICK_ROW_COLORS[row]
        });
      }
    }
  }

  init() {
    this.canvas = document.getElementById("preview-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    this.setupTouchControls();

    document.getElementById("connect-btn").addEventListener("click", () => this.handleConnect());
    document.getElementById("disconnect-btn").addEventListener("click", () => this.handleDisconnect());
    document.getElementById("start-btn").addEventListener("click", () => this.startGame());
    document.getElementById("stop-btn").addEventListener("click", () => this.stopGame());

    this.drawPreview();
    this.showStatus("Connect to device and tap Start to play!", "info");
  }

  setupTouchControls() {
    const touchArea = document.getElementById("touch-area");

    const handlePosition = (clientX) => {
      const rect = touchArea.getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      this.paddleX = Math.max(0, Math.min(
        this.GRID_W - this.PADDLE_W,
        Math.round(relX * this.GRID_W) - Math.floor(this.PADDLE_W / 2)
      ));
      this.updatePaddleIndicator(relX);
      if (!this.isRunning) this.drawPreview();
    };

    touchArea.addEventListener("touchstart", (e) => {
      e.preventDefault();
      handlePosition(e.touches[0].clientX);
    }, { passive: false });

    touchArea.addEventListener("touchmove", (e) => {
      e.preventDefault();
      handlePosition(e.touches[0].clientX);
    }, { passive: false });

    let mouseDown = false;
    touchArea.addEventListener("mousedown", (e) => {
      mouseDown = true;
      handlePosition(e.clientX);
    });
    touchArea.addEventListener("mousemove", (e) => {
      if (mouseDown) handlePosition(e.clientX);
    });
    touchArea.addEventListener("mouseup", () => { mouseDown = false; });
    touchArea.addEventListener("mouseleave", () => { mouseDown = false; });
  }

  updatePaddleIndicator(relX) {
    const indicator = document.getElementById("paddle-indicator");
    if (!indicator) return;
    const leftPct = ((this.paddleX + this.PADDLE_W / 2) / this.GRID_W) * 100;
    indicator.style.left = `${leftPct}%`;
  }

  resetBall() {
    this.ball = {
      x: this.paddleX + this.PADDLE_W / 2,
      y: this.PADDLE_Y - 2.0
    };
    const angle = (Math.random() * 60 - 30) * Math.PI / 180;
    const speed = 0.4;
    this.ballVel = {
      x: speed * Math.sin(angle),
      y: -speed * Math.cos(angle)
    };
  }

  startGame() {
    if (this.isRunning) return;
    this.score = 0;
    this.lives = 3;
    this.paddleX = 8;
    this.initBricks();
    this.resetBall();
    this.updateScore();
    this.isRunning = true;
    this.gameLoopId = setInterval(() => this.tick(), 80);
    document.getElementById("start-btn").disabled = true;
    document.getElementById("stop-btn").disabled = false;
    this.showStatus("Game running! Slide your finger to control the paddle.", "success");
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
    // Move ball
    const prevX = this.ball.x;
    const prevY = this.ball.y;
    this.ball.x += this.ballVel.x;
    this.ball.y += this.ballVel.y;

    // Bounce off left/right walls
    if (this.ball.x <= 0) {
      this.ball.x = 0;
      this.ballVel.x = Math.abs(this.ballVel.x);
    }
    if (this.ball.x >= this.GRID_W - 1) {
      this.ball.x = this.GRID_W - 1;
      this.ballVel.x = -Math.abs(this.ballVel.x);
    }

    // Bounce off top wall
    if (this.ball.y <= 0) {
      this.ball.y = 0;
      this.ballVel.y = Math.abs(this.ballVel.y);
    }

    // Ball falls below paddle — lose a life
    if (this.ball.y >= this.GRID_H) {
      this.lives--;
      this.updateScore();
      if (this.lives <= 0) {
        this.drawPreview();
        this.stopGame();
        this.showStatus(`Game Over! Final score: ${this.score}`, "error");
        return;
      }
      this.resetBall();
      this.showStatus(`Lives: ${this.lives} — Keep going!`, "info");
      this.drawPreview();
      return;
    }

    const ballGridX = Math.round(this.ball.x);
    const ballGridY = Math.round(this.ball.y);

    // Paddle collision — only when ball is moving downward and reaches paddle row
    if (ballGridY >= this.PADDLE_Y && this.ballVel.y > 0) {
      if (ballGridX >= this.paddleX && ballGridX < this.paddleX + this.PADDLE_W) {
        const relHit = (ballGridX - this.paddleX) / (this.PADDLE_W - 1) - 0.5;
        const angle = relHit * (Math.PI / 3);
        const speed = Math.min(0.9, Math.hypot(this.ballVel.x, this.ballVel.y) * 1.03);
        this.ball.y = this.PADDLE_Y - 0.5;
        this.ballVel.x = speed * Math.sin(angle);
        this.ballVel.y = -speed * Math.cos(angle);
      }
    }

    // Brick collision
    const prevGridX = Math.round(prevX);
    const prevGridY = Math.round(prevY);
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      if (ballGridX === brick.x && ballGridY === brick.y) {
        brick.alive = false;
        this.score += 10;
        // Determine collision axis from previous position
        if (prevGridX !== brick.x) {
          this.ballVel.x = -this.ballVel.x;
        } else {
          this.ballVel.y = -this.ballVel.y;
        }
        this.updateScore();
        break;
      }
    }

    // Check win condition
    if (this.bricks.every(b => !b.alive)) {
      this.drawPreview();
      this.stopGame();
      this.showStatus(`You Win! Final score: ${this.score}`, "success");
      return;
    }

    this.drawPreview();

    if (this.bluetooth.isConnected() && this.pixelQueue.length < 30) {
      this.queueLEDUpdate();
    }
  }

  getGamePixels() {
    const pixels = new Map();

    // Bricks
    for (const brick of this.bricks) {
      if (brick.alive) {
        pixels.set(`${brick.x},${brick.y}`, brick.color);
      }
    }

    // Paddle (white)
    for (let px = this.paddleX; px < this.paddleX + this.PADDLE_W; px++) {
      if (px >= 0 && px < this.GRID_W) {
        pixels.set(`${px},${this.PADDLE_Y}`, Bluetooth.PixelColors.WHITE);
      }
    }

    // Ball (white)
    const bx = Math.round(this.ball.x);
    const by = Math.round(this.ball.y);
    if (bx >= 0 && bx < this.GRID_W && by >= 0 && by < this.GRID_H) {
      pixels.set(`${bx},${by}`, Bluetooth.PixelColors.WHITE);
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

  updateScore() {
    document.getElementById("score").textContent = this.score;
    document.getElementById("lives").textContent = this.lives;
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
