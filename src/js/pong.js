import Bluetooth from "./ble.js";

// Maximum launch angle (degrees) when resetting the ball
const MAX_INITIAL_ANGLE_DEGREES = 20;

// Device hue range: the LED color byte maps hue 0-360° onto 0-180
const DEVICE_HUE_RANGE = 180;

export default class PongGame {
  constructor() {
    this.bluetooth = new Bluetooth();

    this.GRID_W = 20;
    this.GRID_H = 20;
    this.PADDLE_H = 4;
    this.PLAYER_X = 1;
    this.AI_X = 18;

    // Game state (float positions for smooth movement)
    this.ball = { x: 10, y: 10 };
    this.ballVel = { x: 0.4, y: 0.3 };
    this.playerY = 8;   // paddle top row
    this.aiY = 8.0;     // AI paddle top (float for smooth movement)

    this.playerScore = 0;
    this.aiScore = 0;

    this.isRunning = false;
    this.gameLoopId = null;

    // Canvas preview
    this.canvas = null;
    this.ctx = null;

    // BLE pixel queue and state
    this.pixelQueue = [];
    this.isWriting = false;
    this.prevPixels = new Map(); // "x,y" -> colorByte
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

    this.resetBall();
    this.drawPreview();
    this.showStatus("Connect to device and tap Start to play!", "info");
  }

  setupTouchControls() {
    const touchArea = document.getElementById("touch-area");

    const handlePosition = (clientY) => {
      const rect = touchArea.getBoundingClientRect();
      const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      this.playerY = Math.max(0, Math.min(
        this.GRID_H - this.PADDLE_H,
        Math.round(relY * this.GRID_H) - Math.floor(this.PADDLE_H / 2)
      ));
      this.updatePaddleIndicator(relY);
    };

    touchArea.addEventListener("touchstart", (e) => {
      e.preventDefault();
      handlePosition(e.touches[0].clientY);
    }, { passive: false });

    touchArea.addEventListener("touchmove", (e) => {
      e.preventDefault();
      handlePosition(e.touches[0].clientY);
    }, { passive: false });

    let mouseDown = false;
    touchArea.addEventListener("mousedown", (e) => {
      mouseDown = true;
      handlePosition(e.clientY);
    });
    touchArea.addEventListener("mousemove", (e) => {
      if (mouseDown) handlePosition(e.clientY);
    });
    touchArea.addEventListener("mouseup", () => { mouseDown = false; });
    touchArea.addEventListener("mouseleave", () => { mouseDown = false; });
  }

  updatePaddleIndicator(relY) {
    const indicator = document.getElementById("paddle-indicator");
    if (!indicator) return;
    // Align the indicator's top to the paddle's top row position
    const topPct = ((this.playerY + this.PADDLE_H / 2) / this.GRID_H) * 100;
    indicator.style.top = `${topPct}%`;
  }

  resetBall() {
    this.ball = { x: 10.0, y: 10.0 };
    const angle = (Math.random() * MAX_INITIAL_ANGLE_DEGREES * 2 - MAX_INITIAL_ANGLE_DEGREES) * Math.PI / 180;
    const speed = 0.45;
    const dir = Math.random() > 0.5 ? 1 : -1;
    this.ballVel = {
      x: dir * speed * Math.cos(angle),
      y: speed * Math.sin(angle)
    };
  }

  startGame() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.resetBall();
    this.gameLoopId = setInterval(() => this.tick(), 100);
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
    this.ball.x += this.ballVel.x;
    this.ball.y += this.ballVel.y;

    // Bounce off top/bottom walls
    if (this.ball.y <= 0) {
      this.ball.y = 0;
      this.ballVel.y = Math.abs(this.ballVel.y);
    }
    if (this.ball.y >= this.GRID_H - 1) {
      this.ball.y = this.GRID_H - 1;
      this.ballVel.y = -Math.abs(this.ballVel.y);
    }

    const ballGridX = Math.round(this.ball.x);
    const ballGridY = Math.round(this.ball.y);

    // Player paddle collision (left)
    if (ballGridX <= this.PLAYER_X && this.ballVel.x < 0) {
      if (ballGridY >= this.playerY && ballGridY < this.playerY + this.PADDLE_H) {
        const relHit = (ballGridY - this.playerY) / (this.PADDLE_H - 1) - 0.5;
        const { vx, vy } = this.bounceBall(relHit, 1);
        this.ball.x = this.PLAYER_X + 0.5;
        this.ballVel.x = vx;
        this.ballVel.y = vy;
      }
    }

    // AI paddle collision (right)
    if (ballGridX >= this.AI_X && this.ballVel.x > 0) {
      const aiPaddleTop = Math.round(this.aiY);
      if (ballGridY >= aiPaddleTop && ballGridY < aiPaddleTop + this.PADDLE_H) {
        const relHit = (ballGridY - aiPaddleTop) / (this.PADDLE_H - 1) - 0.5;
        const { vx, vy } = this.bounceBall(relHit, -1);
        this.ball.x = this.AI_X - 0.5;
        this.ballVel.x = vx;
        this.ballVel.y = vy;
      }
    }

    // Score: ball past left edge
    if (this.ball.x < 0) {
      this.aiScore++;
      this.updateScore();
      this.resetBall();
      return;
    }

    // Score: ball past right edge
    if (this.ball.x >= this.GRID_W) {
      this.playerScore++;
      this.updateScore();
      this.resetBall();
      return;
    }

    this.moveAI();
    this.drawPreview();

    if (this.bluetooth.isConnected() && this.pixelQueue.length < 30) {
      this.queueLEDUpdate();
    }
  }

  /**
   * Calculate new ball velocity after bouncing off a paddle.
   * @param {number} relHit - Relative hit position (-0.5 to 0.5, centre = 0)
   * @param {number} xDirection - +1 (ball goes right) or -1 (ball goes left)
   * @returns {{ vx: number, vy: number }}
   */
  bounceBall(relHit, xDirection) {
    const speed = Math.min(0.9, Math.hypot(this.ballVel.x, this.ballVel.y) * 1.05);
    const angle = relHit * (Math.PI / 3);
    return {
      vx: xDirection * speed * Math.cos(angle),
      vy: speed * Math.sin(angle)
    };
  }

  moveAI() {
    const ballY = this.ball.y;
    const aiCenter = this.aiY + this.PADDLE_H / 2;
    const distance = ballY - aiCenter;

    // Speed scales with how far the paddle is from the ball center
    const minSpeed = 0.1;
    const maxSpeed = 1.5;
    const speed = minSpeed + (Math.abs(distance) / this.GRID_H) * (maxSpeed - minSpeed);

    if (Math.abs(distance) > 0.1) {
      this.aiY += Math.sign(distance) * speed;
    }
    this.aiY = Math.max(0, Math.min(this.GRID_H - this.PADDLE_H, this.aiY));
  }

  getGamePixels() {
    const pixels = new Map();

    // Net: center column, every other row
    for (let y = 0; y < this.GRID_H; y += 2) {
      pixels.set(`10,${y}`, Bluetooth.PixelColors.BLUE);
    }

    // Player paddle (column PLAYER_X, green)
    for (let py = this.playerY; py < this.playerY + this.PADDLE_H; py++) {
      if (py >= 0 && py < this.GRID_H) {
        pixels.set(`${this.PLAYER_X},${py}`, Bluetooth.PixelColors.GREEN);
      }
    }

    // AI paddle (column AI_X, red)
    const aiTop = Math.round(this.aiY);
    for (let py = aiTop; py < aiTop + this.PADDLE_H; py++) {
      if (py >= 0 && py < this.GRID_H) {
        pixels.set(`${this.AI_X},${py}`, Bluetooth.PixelColors.RED);
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
      default: {
        // Map device hue byte (0–DEVICE_HUE_RANGE) back to CSS hue (0–360°)
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
        console.error("BLE write error:", err);
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
      console.error("clearPixels error:", err);
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
    document.getElementById("player-score").textContent = this.playerScore;
    document.getElementById("ai-score").textContent = this.aiScore;
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
