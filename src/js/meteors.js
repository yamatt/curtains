import Bluetooth from "./ble.js";

const GRID_W = 20;
const GRID_H = 20;
const SHIP_ROW = GRID_H - 1;

export default class MeteorsGame {
  constructor() {
    this.bluetooth = new Bluetooth();

    // Game state
    this.shipX = Math.floor(GRID_W / 2);
    this.meteors = []; // [{x, y}] - y is a float for smooth movement
    this.tickCount = 0;
    this.score = 0; // seconds survived
    this.isRunning = false;
    this.gameLoopId = null;

    // Canvas preview
    this.canvas = null;
    this.ctx = null;

    // BLE queue management
    this.pixelQueue = [];
    this.isWriting = false;
    this.prevPixels = new Map();

    // Input state
    this.movingLeft = false;
    this.movingRight = false;
    this.tiltX = 0; // from DeviceOrientationEvent.gamma (-90 to +90)
  }

  init() {
    this.canvas = document.getElementById("preview-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    this.setupControls();

    document.getElementById("connect-btn").addEventListener("click",
      () => this.handleConnect());
    document.getElementById("disconnect-btn").addEventListener("click",
      () => this.handleDisconnect());
    document.getElementById("start-btn").addEventListener("click",
      () => this.startGame());
    document.getElementById("stop-btn").addEventListener("click",
      () => this.stopGame());

    this.drawPreview();
    this.showStatus("Connect to device and tap Start to play!", "info");
  }

  setupControls() {
    const touchArea = document.getElementById("touch-area");

    // Tap/hold the left half to move left, right half to move right
    const handleTouch = (clientX) => {
      const rect = touchArea.getBoundingClientRect();
      if (clientX - rect.left < rect.width / 2) {
        this.movingLeft = true;
        this.movingRight = false;
      } else {
        this.movingRight = true;
        this.movingLeft = false;
      }
    };

    const stopTouch = () => {
      this.movingLeft = false;
      this.movingRight = false;
    };

    touchArea.addEventListener("touchstart", (e) => {
      e.preventDefault();
      handleTouch(e.touches[0].clientX);
    }, { passive: false });
    touchArea.addEventListener("touchmove", (e) => {
      e.preventDefault();
      handleTouch(e.touches[0].clientX);
    }, { passive: false });
    touchArea.addEventListener("touchend", stopTouch);
    touchArea.addEventListener("touchcancel", stopTouch);

    let mouseDown = false;
    touchArea.addEventListener("mousedown", (e) => {
      mouseDown = true;
      handleTouch(e.clientX);
    });
    touchArea.addEventListener("mousemove", (e) => {
      if (mouseDown) handleTouch(e.clientX);
    });
    touchArea.addEventListener("mouseup", stopTouch);

    // Device tilt via DeviceOrientationEvent
    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", (e) => {
        // gamma: rotation around Y-axis, negative = left tilt, positive = right tilt
        this.tiltX = e.gamma || 0;
      });
    }

    // Keyboard support (arrow keys)
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") this.movingLeft = true;
      if (e.key === "ArrowRight") this.movingRight = true;
    });
    document.addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft") this.movingLeft = false;
      if (e.key === "ArrowRight") this.movingRight = false;
    });
  }

  startGame() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.shipX = Math.floor(GRID_W / 2);
    this.meteors = [];
    this.tickCount = 0;
    this.score = 0;
    this.movingLeft = false;
    this.movingRight = false;
    this.pixelQueue = [];
    this.prevPixels = new Map();
    this.updateScore();

    document.getElementById("start-btn").disabled = true;
    document.getElementById("stop-btn").disabled = false;

    this.gameLoopId = setInterval(() => this.tick(), 100);
    this.showStatus("Dodge the meteors! 🚀", "success");
  }

  stopGame() {
    this.isRunning = false;
    if (this.gameLoopId) {
      clearInterval(this.gameLoopId);
      this.gameLoopId = null;
    }
    this.movingLeft = false;
    this.movingRight = false;
    document.getElementById("start-btn").disabled = false;
    document.getElementById("stop-btn").disabled = true;
    this.pixelQueue = [];
    this.showStatus("Game stopped.", "info");
  }

  get meteorSpeed() {
    // Increases from 0.2 to 0.7 rows per tick over ~50 seconds of gameplay
    return Math.min(0.7, 0.2 + this.tickCount * 0.001);
  }

  get spawnRate() {
    // Decreases from 1 meteor every 8 ticks to 1 every 3 ticks
    return Math.max(3, 8 - Math.floor(this.tickCount / 100));
  }

  tick() {
    this.tickCount++;

    // Move ship based on touch/tilt/keyboard input (1 pixel per tick)
    const TILT_THRESHOLD = 15;
    if (this.movingLeft || this.tiltX < -TILT_THRESHOLD) {
      this.shipX = Math.max(0, this.shipX - 1);
    } else if (this.movingRight || this.tiltX > TILT_THRESHOLD) {
      this.shipX = Math.min(GRID_W - 1, this.shipX + 1);
    }

    // Spawn a new meteor at a random column
    if (this.tickCount % this.spawnRate === 0) {
      this.meteors.push({ x: Math.floor(Math.random() * GRID_W), y: 0 });
    }

    // Move all meteors down by current speed
    const speed = this.meteorSpeed;
    for (const meteor of this.meteors) {
      meteor.y += speed;
    }

    // Collision detection: meteor reaches or passes through the ship row at the ship's column
    const hit = this.meteors.some(
      m => m.y >= SHIP_ROW - 0.5 && m.x === this.shipX
    );
    if (hit) {
      this.gameOver();
      return;
    }

    // Remove meteors that have scrolled off the bottom
    this.meteors = this.meteors.filter(m => m.y < GRID_H);

    // Increment score every 10 ticks (~1 second at 100ms tick rate)
    if (this.tickCount % 10 === 0) {
      this.score++;
      this.updateScore();
    }

    this.drawPreview();
    if (this.bluetooth.isConnected() && this.pixelQueue.length < 30) {
      this.queueLEDUpdate();
    }
  }

  gameOver() {
    this.isRunning = false;
    if (this.gameLoopId) {
      clearInterval(this.gameLoopId);
      this.gameLoopId = null;
    }
    document.getElementById("start-btn").disabled = false;
    document.getElementById("stop-btn").disabled = true;
    this.drawPreview();
    this.showStatus(`💥 Game Over! You survived ${this.score} seconds.`, "error");
  }

  getGamePixels() {
    const pixels = new Map();

    // Spaceship (GREEN at bottom row)
    if (this.shipX >= 0 && this.shipX < GRID_W) {
      pixels.set(`${this.shipX},${SHIP_ROW}`, Bluetooth.PixelColors.GREEN);
    }

    // Meteors: orange when far away, red when close to the ship
    for (const meteor of this.meteors) {
      const my = Math.round(meteor.y);
      if (meteor.x >= 0 && meteor.x < GRID_W && my >= 0 && my < GRID_H) {
        const color = my > GRID_H * 0.6
          ? Bluetooth.PixelColors.RED
          : Bluetooth.PixelColors.ORANGE;
        pixels.set(`${meteor.x},${my}`, color);
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
      case Bluetooth.PixelColors.ORANGE: return "#FF6600";
      case Bluetooth.PixelColors.BLUE:   return "#0044CC";
      case Bluetooth.PixelColors.YELLOW: return "#CCCC00";
      default: {
        const hue = (colorByte / 180) * 360;
        return `hsl(${hue}, 100%, 50%)`;
      }
    }
  }

  drawPreview() {
    const pixels = this.getGamePixels();
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cellW = w / GRID_W;
    const cellH = h / GRID_H;

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

    // Turn off pixels no longer lit
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
