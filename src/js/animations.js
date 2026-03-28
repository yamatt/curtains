import Bluetooth from "./ble.js";

const GRID_W = 20;
const GRID_H = 20;

// Cyan colour byte for blue fire: device hue 90 → (90/180)*360 = 180° CSS hue
const BLUE_FIRE_CYAN = 0x5A;
const MATRIX_TRAIL_COLORS = [
  Bluetooth.PixelColors.WHITE,  // head – bright flash
  Bluetooth.PixelColors.GREEN,  // bright green
  0x30,                         // yellow-green (fading)
  0x20,                         // yellow (almost gone)
];

export default class AnimationsPage {
  constructor() {
    this.bluetooth = new Bluetooth();

    this.isRunning = false;
    this.animationLoopId = null;
    this.tickCount = 0;
    this.currentAnimation = null; // 'emergency' | 'rainbow' | 'matrix' | 'fire'

    // Canvas preview
    this.canvas = null;
    this.ctx = null;

    // BLE queue management
    this.pixelQueue = [];
    this.isWriting = false;
    this.prevPixels = new Map();

    // Emergency state
    this.emergencyPhase = false; // false = off, true = orange

    // Rainbow state
    this.rainbowFlashRow = 0;
    this.rainbowFlashPhase = 0; // 0 = row lit, 1 = row off

    // Matrix state
    this.matrixDrops = []; // [{col, headY, speed, trailLen}]

    // Fire state
    this.fireMode = "normal"; // 'normal' | 'blue'
    this.fireHeights = new Array(GRID_W).fill(15); // rows from top that are lit per column
  }

  init() {
    this.canvas = document.getElementById("preview-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    document.getElementById("connect-btn").addEventListener("click",
      () => this.handleConnect());
    document.getElementById("disconnect-btn").addEventListener("click",
      () => this.handleDisconnect());
    document.getElementById("stop-btn").addEventListener("click",
      () => this.stopAnimation());

    document.getElementById("btn-emergency").addEventListener("click",
      () => this.selectAnimation("emergency"));
    document.getElementById("btn-rainbow").addEventListener("click",
      () => this.selectAnimation("rainbow"));
    document.getElementById("btn-matrix").addEventListener("click",
      () => this.selectAnimation("matrix"));
    document.getElementById("btn-fire-normal").addEventListener("click", () => {
      this.fireMode = "normal";
      this.selectAnimation("fire");
    });
    document.getElementById("btn-fire-blue").addEventListener("click", () => {
      this.fireMode = "blue";
      this.selectAnimation("fire");
    });

    this.drawPreview();
    this.showStatus("Connect to device and select an animation.", "info");
  }

  async selectAnimation(name) {
    this.stopAnimation();
    this.currentAnimation = name;

    // Non-emergency animations use pixel draw mode
    if (name !== "emergency" && this.bluetooth.isConnected()) {
      try {
        await this.bluetooth.enterDrawMode();
        await this.bluetooth.clearPixels();
      } catch (err) {
        this.showStatus(`BLE setup error: ${err.message}`, "error");
      }
    }

    this.startAnimation();
  }

  startAnimation() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tickCount = 0;
    this.pixelQueue = [];
    this.prevPixels = new Map();

    // Reset per-animation state
    this.emergencyPhase = false;
    this.rainbowFlashRow = 0;
    this.rainbowFlashPhase = 0;
    this.matrixDrops = [];
    this.fireHeights = new Array(GRID_W).fill(0).map(
      () => 10 + Math.floor(Math.random() * 8)
    );

    document.getElementById("stop-btn").disabled = false;

    const interval =
      this.currentAnimation === "emergency" ||
      this.currentAnimation === "rainbow" ? 500 : 100;
    this.animationLoopId = setInterval(() => this.tick(), interval);

    this.showStatus(`Running: ${this.getAnimationLabel()}`, "success");
    this.drawPreview();
  }

  getAnimationLabel() {
    switch (this.currentAnimation) {
      case "emergency": return "Emergency 🚨";
      case "rainbow":   return "Rainbow 🌈";
      case "matrix":    return "Matrix 💻";
      case "fire":
        return this.fireMode === "normal" ? "Fire 🔥" : "Blue Fire 🔵";
      default: return this.currentAnimation;
    }
  }

  stopAnimation() {
    this.isRunning = false;
    if (this.animationLoopId) {
      clearInterval(this.animationLoopId);
      this.animationLoopId = null;
    }
    document.getElementById("stop-btn").disabled = true;
    this.pixelQueue = [];
    this.showStatus("Stopped.", "info");
  }

  tick() {
    this.tickCount++;

    switch (this.currentAnimation) {
      case "emergency": this.tickEmergency(); break;
      case "rainbow":   this.tickRainbow();   break;
      case "matrix":    this.tickMatrix();    break;
      case "fire":      this.tickFire();      break;
    }

    this.drawPreview();

    // Emergency uses the solid-colour BLE command directly; all other
    // animations use the pixel-update draw mode.
    if (this.currentAnimation !== "emergency" &&
        this.bluetooth.isConnected() &&
        this.pixelQueue.length < 50) {
      this.queueLEDUpdate();
    }
  }

  // ─── Emergency ────────────────────────────────────────────────────────────

  tickEmergency() {
    this.emergencyPhase = !this.emergencyPhase;

    if (!this.bluetooth.isConnected()) return;

    // setSolidColor(hue 0-360, saturation 0-1000, brightness 0-1000)
    const promise = this.emergencyPhase
      // Orange – hue 30°, saturation 100 % (1000), full brightness (1000)
      ? this.bluetooth.setSolidColor(30, 1000, 1000)
      // Off – brightness 0 turns the display black
      : this.bluetooth.setSolidColor(30, 1000, 0);

    promise.catch(err =>
      this.showStatus(`BLE error: ${err.message}`, "error")
    );
  }

  // ─── Rainbow ──────────────────────────────────────────────────────────────

  tickRainbow() {
    if (this.rainbowFlashPhase === 0) {
      // Row currently on → turn it off
      this.rainbowFlashPhase = 1;
    } else {
      // Row currently off → turn it back on, advance to next row
      this.rainbowFlashPhase = 0;
      this.rainbowFlashRow = (this.rainbowFlashRow + 1) % GRID_H;
    }
  }

  // ─── Matrix ───────────────────────────────────────────────────────────────

  tickMatrix() {
    // Move existing drops downward
    for (const drop of this.matrixDrops) {
      drop.headY += drop.speed;
    }

    // Remove drops that have fully scrolled off the bottom
    this.matrixDrops = this.matrixDrops.filter(
      d => d.headY - d.trailLen < GRID_H
    );

    // Randomly spawn a new drop
    if (Math.random() < 0.3 && this.matrixDrops.length < 10) {
      this.matrixDrops.push({
        col:      Math.floor(Math.random() * GRID_W),
        headY:    0,
        speed:    0.3 + Math.random() * 0.5,
        trailLen: MATRIX_TRAIL_COLORS.length,
      });
    }
  }

  // ─── Fire ─────────────────────────────────────────────────────────────────

  tickFire() {
    for (let x = 0; x < GRID_W; x++) {
      // Random-walk the flame height of each column
      this.fireHeights[x] += Math.floor(Math.random() * 5) - 2;
      this.fireHeights[x] = Math.max(5, Math.min(GRID_H - 1, this.fireHeights[x]));
    }
  }

  // ─── Pixel maps ───────────────────────────────────────────────────────────

  getAnimationPixels() {
    switch (this.currentAnimation) {
      case "emergency": return this.getEmergencyPixels();
      case "rainbow":   return this.getRainbowPixels();
      case "matrix":    return this.getMatrixPixels();
      case "fire":      return this.getFirePixels();
      default:          return new Map();
    }
  }

  getEmergencyPixels() {
    const pixels = new Map();
    if (this.emergencyPhase) {
      for (let x = 0; x < GRID_W; x++) {
        for (let y = 0; y < GRID_H; y++) {
          pixels.set(`${x},${y}`, Bluetooth.PixelColors.ORANGE);
        }
      }
    }
    // phase false → empty map; diff will turn all pixels off
    return pixels;
  }

  getRainbowPixels() {
    const pixels = new Map();
    for (let y = 0; y < GRID_H; y++) {
      // Skip the currently-flashing row when it is in the "off" phase
      if (y === this.rainbowFlashRow && this.rainbowFlashPhase === 1) continue;

      // Spread the full hue wheel across the 20 rows.
      // The device uses a compressed hue range of 0-180 (not 0-255), so we
      // scale: colorByte = (hue° / 360) * 180.
      const hue = (y / GRID_H) * 360;
      const colorByte = Math.round((hue / 360) * 180) & 0xFF;
      for (let x = 0; x < GRID_W; x++) {
        pixels.set(`${x},${y}`, colorByte);
      }
    }
    return pixels;
  }

  getMatrixPixels() {
    const pixels = new Map();

    for (const drop of this.matrixDrops) {
      const headY = Math.floor(drop.headY);

      for (let t = 0; t < MATRIX_TRAIL_COLORS.length; t++) {
        const py = headY - t;
        if (py < 0 || py >= GRID_H) continue;

        const key = `${drop.col},${py}`;
        // A head pixel always overrides older trail pixels in the same cell
        if (!pixels.has(key)) {
          pixels.set(key, MATRIX_TRAIL_COLORS[t]);
        }
      }
    }

    return pixels;
  }

  getFirePixels() {
    const pixels = new Map();
    for (let x = 0; x < GRID_W; x++) {
      const flameH = this.fireHeights[x];
      for (let y = 0; y < flameH; y++) {
        // y=0 is the top (hottest); y=flameH-1 is the tip (coolest)
        const heat = 1 - y / flameH;
        pixels.set(`${x},${y}`, this.getFireColorByte(heat));
      }
    }
    return pixels;
  }

  getFireColorByte(heat) {
    if (this.fireMode === "normal") {
      if (heat > 0.85) return Bluetooth.PixelColors.WHITE;
      if (heat > 0.65) return Bluetooth.PixelColors.YELLOW;
      if (heat > 0.35) return Bluetooth.PixelColors.ORANGE;
      return Bluetooth.PixelColors.RED;
    } else {
      // Blue fire: white → cyan → blue → purple
      if (heat > 0.85) return Bluetooth.PixelColors.WHITE;
      if (heat > 0.65) return BLUE_FIRE_CYAN;
      if (heat > 0.35) return Bluetooth.PixelColors.BLUE;
      return Bluetooth.PixelColors.PURPLE;
    }
  }

  // ─── Canvas preview ───────────────────────────────────────────────────────

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
    const pixels = this.getAnimationPixels();
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

  // ─── BLE pixel queue ──────────────────────────────────────────────────────

  queueLEDUpdate() {
    const newPixels = this.getAnimationPixels();

    // Turn off pixels that are no longer lit
    this.prevPixels.forEach((colorByte, key) => {
      if (!newPixels.has(key)) {
        const [x, y] = key.split(",").map(Number);
        this.pixelQueue.push({ x, y, colorByte: Bluetooth.PixelColors.OFF });
      }
    });

    // Set pixels that are new or have changed colour
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

  // ─── Connection handling ──────────────────────────────────────────────────

  async handleConnect() {
    const deviceName = document.getElementById("device-name").value;
    const charUuid   = document.getElementById("char-uuid").value;

    if (!charUuid) {
      this.showStatus("Please enter a characteristic UUID.", "error");
      return;
    }

    this.showStatus("Connecting...", "info");
    try {
      await this.bluetooth.connect(deviceName || "");
      this.bluetooth.setCharacteristic(charUuid);
      await this.bluetooth.enterDrawMode();
      this.showStatus("Connected! Select an animation to start.", "success");
    } catch (err) {
      this.showStatus(`Connection failed: ${err.message}`, "error");
    }
  }

  async handleDisconnect() {
    this.stopAnimation();
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
