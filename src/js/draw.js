import Bluetooth from "./ble.js";

export default class DrawingCanvas {
  constructor() {
    this.bluetooth = new Bluetooth();
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.currentColor = { hue: 0, r: 255, g: 0, b: 0 }; // Red by default
    this.currentColorByte = 0x00; // Red
    this.recentColors = []; // Store up to 5 recent colors
    this.pixels = new Array(20 * 20).fill(0xFE); // Initialize with OFF

    // Special color modes
    this.isWhiteMode = false;
    this.isBlackMode = false;

    // Buffering system for pixel updates
    this.updateBuffer = [];
    this.isProcessingBuffer = false;
    this.bufferProcessInterval = null;
  }

  init() {
    // Get canvas and context
    this.canvas = document.getElementById("led-canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

    // Set up canvas rendering
    this.ctx.imageSmoothingEnabled = false;

    // Initialize with black background
    this.clearCanvas();

    // Set up event listeners
    this.setupEventListeners();

    // Initialize color display
    this.updateCurrentColorDisplay();

    // Start buffer processing
    this.startBufferProcessing();

    this.showStatus("Ready. Connect to begin drawing.", "info");
  }

  setupEventListeners() {
    // Connection buttons
    document.getElementById("connect-btn").addEventListener("click", () => this.handleConnect());
    document.getElementById("disconnect-btn").addEventListener("click", () => this.handleDisconnect());

    // Canvas drawing events
    this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
    this.canvas.addEventListener("mousemove", (e) => this.draw(e));
    this.canvas.addEventListener("mouseup", () => this.stopDrawing());
    this.canvas.addEventListener("mouseleave", () => this.stopDrawing());

    // Touch events for mobile
    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.startDrawing(e.touches[0]);
    });
    this.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      this.draw(e.touches[0]);
    });
    this.canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      this.stopDrawing();
    });

    // Action buttons
    document.getElementById("clear-btn").addEventListener("click", () => this.clearCanvas());
    document.getElementById("send-all-btn").addEventListener("click", () => this.sendAllPixels());

    // Color selection
    document.getElementById("white-btn").addEventListener("click", () => this.selectWhite());
    document.getElementById("black-btn").addEventListener("click", () => this.selectBlack());
    document.getElementById("hue-slider").addEventListener("input", (e) => this.selectHue(e.target.value));
  }

  getCanvasCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    return { x, y };
  }

  startDrawing(event) {
    this.isDrawing = true;
    this.draw(event);
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  draw(event) {
    if (!this.isDrawing) return;

    const { x, y } = this.getCanvasCoordinates(event);

    if (x >= 0 && x < 20 && y >= 0 && y < 20) {
      this.setPixelColor(x, y);
    }
  }

  setPixelColor(x, y) {
    // Update local pixel array (column-major order for LED matrix)
    const index = x * 20 + y;
    this.pixels[index] = this.currentColorByte;

    // Draw on canvas
    this.ctx.fillStyle = this.isBlackMode ? "#000000" :
                         this.isWhiteMode ? "#FFFFFF" :
                         `hsl(${this.currentColor.hue}, 100%, 50%)`;
    this.ctx.fillRect(x, y, 1, 1);

    // Add to buffer if connected
    if (this.bluetooth.isConnected()) {
      this.addToBuffer(x, y, this.currentColorByte);
    }

    // Add to recent colors
    this.addToRecentColors();
  }

  addToBuffer(x, y, colorByte) {
    // Check if this pixel is already in the buffer
    const existingIndex = this.updateBuffer.findIndex(
      update => update.x === x && update.y === y
    );

    if (existingIndex !== -1) {
      // Update existing entry with new color
      this.updateBuffer[existingIndex].colorByte = colorByte;
    } else {
      // Add new entry to buffer
      this.updateBuffer.push({ x, y, colorByte });
    }
  }

  startBufferProcessing() {
    // Process buffer every 50ms
    this.bufferProcessInterval = setInterval(() => {
      this.processBuffer();
    }, 50);
  }

  stopBufferProcessing() {
    if (this.bufferProcessInterval) {
      clearInterval(this.bufferProcessInterval);
      this.bufferProcessInterval = null;
    }
  }

  async processBuffer() {
    if (this.isProcessingBuffer || this.updateBuffer.length === 0 || !this.bluetooth.isConnected()) {
      return;
    }

    this.isProcessingBuffer = true;

    try {
      // Take the first update from buffer
      const update = this.updateBuffer.shift();

      if (update) {
        await this.bluetooth.setPixel(update.x, update.y, update.colorByte);
      }
    } catch (error) {
      console.error("Error processing buffer:", error);
      // On error, we've already removed the item, so we continue
    } finally {
      this.isProcessingBuffer = false;

      // Update status if buffer has items
      if (this.updateBuffer.length > 0) {
        this.showStatus(`Drawing... (${this.updateBuffer.length} pixels queued)`, "info");
      }
    }
  }

  async sendAllPixels() {
    if (!this.bluetooth.isConnected()) {
      this.showStatus("Please connect to device first", "error");
      return;
    }

    // Clear buffer first
    this.updateBuffer = [];

    this.showStatus("Sending all pixels to device...", "info");

    try {
      let sentCount = 0;
      // Process column by column (top to bottom, then left to right)
      for (let x = 0; x < 20; x++) {
        for (let y = 0; y < 20; y++) {
          const index = x * 20 + y;
          await this.bluetooth.setPixel(x, y, this.pixels[index]);
          sentCount++;

          // Update status every 50 pixels
          if (sentCount % 50 === 0) {
            this.showStatus(`Sending pixels: ${sentCount}/400...`, "info");
          }
        }
      }
      this.showStatus(`Successfully sent all 400 pixels to device!`, "success");
    } catch (error) {
      this.showStatus(`Error sending pixels: ${error.message}`, "error");
      console.error(error);
    }
  }

  async clearCanvas() {
    // Clear canvas to black
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, 20, 20);

    // Reset pixel array to OFF
    this.pixels.fill(0xFE);

    // Clear the buffer
    this.updateBuffer = [];

    // Clear the LED matrix if connected
    if (this.bluetooth.isConnected()) {
      try {
        await this.bluetooth.clearPixels();
        this.showStatus("Canvas and LED matrix cleared", "success");
      } catch (error) {
        this.showStatus(`Cleared canvas but error clearing LEDs: ${error.message}`, "error");
        console.error(error);
      }
    }
  }

  selectWhite() {
    this.isWhiteMode = true;
    this.isBlackMode = false;
    this.currentColorByte = Bluetooth.PixelColors.WHITE;
    this.currentColor = { hue: 0, r: 255, g: 255, b: 255 };
    this.updateCurrentColorDisplay();
    this.addToRecentColors();
  }

  selectBlack() {
    this.isWhiteMode = false;
    this.isBlackMode = true;
    this.currentColorByte = Bluetooth.PixelColors.OFF;
    this.currentColor = { hue: 0, r: 0, g: 0, b: 0 };
    this.updateCurrentColorDisplay();
    this.addToRecentColors();
  }

  selectHue(hue) {
    this.isWhiteMode = false;
    this.isBlackMode = false;
    this.currentColor.hue = parseInt(hue);

    // Convert hue to RGB for display
    const rgb = this.hslToRgb(this.currentColor.hue, 100, 50);
    this.currentColor.r = rgb.r;
    this.currentColor.g = rgb.g;
    this.currentColor.b = rgb.b;

    // Convert to device color byte
    this.currentColorByte = Bluetooth.hslToPixelColor(this.currentColor.hue, 100, 50);

    this.updateCurrentColorDisplay();
  }

  hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r, g, b;
    if (h < 60) {
      [r, g, b] = [c, x, 0];
    } else if (h < 120) {
      [r, g, b] = [x, c, 0];
    } else if (h < 180) {
      [r, g, b] = [0, c, x];
    } else if (h < 240) {
      [r, g, b] = [0, x, c];
    } else if (h < 300) {
      [r, g, b] = [x, 0, c];
    } else {
      [r, g, b] = [c, 0, x];
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  updateCurrentColorDisplay() {
    const colorBox = document.getElementById("current-color");
    if (this.isBlackMode) {
      colorBox.style.backgroundColor = "#000000";
    } else if (this.isWhiteMode) {
      colorBox.style.backgroundColor = "#FFFFFF";
    } else {
      colorBox.style.backgroundColor = `hsl(${this.currentColor.hue}, 100%, 50%)`;
    }
  }

  addToRecentColors() {
    const colorKey = this.isBlackMode ? "black" :
                     this.isWhiteMode ? "white" :
                     `hue-${this.currentColor.hue}`;

    // Remove if already exists
    this.recentColors = this.recentColors.filter(c => c.key !== colorKey);

    // Add to front
    this.recentColors.unshift({
      key: colorKey,
      isBlack: this.isBlackMode,
      isWhite: this.isWhiteMode,
      hue: this.currentColor.hue,
      colorByte: this.currentColorByte
    });

    // Keep only 5 most recent
    this.recentColors = this.recentColors.slice(0, 5);

    this.updateRecentColorsDisplay();
  }

  updateRecentColorsDisplay() {
    const container = document.getElementById("recent-colors-list");
    container.innerHTML = "";

    this.recentColors.forEach(color => {
      const box = document.createElement("div");
      box.className = "recent-color-box";

      if (color.isBlack) {
        box.style.backgroundColor = "#000000";
      } else if (color.isWhite) {
        box.style.backgroundColor = "#FFFFFF";
      } else {
        box.style.backgroundColor = `hsl(${color.hue}, 100%, 50%)`;
      }

      box.addEventListener("click", () => {
        this.isBlackMode = color.isBlack;
        this.isWhiteMode = color.isWhite;
        this.currentColor.hue = color.hue;
        this.currentColorByte = color.colorByte;

        if (!color.isBlack && !color.isWhite) {
          document.getElementById("hue-slider").value = color.hue;
        }

        this.updateCurrentColorDisplay();
      });

      container.appendChild(box);
    });
  }

  async handleConnect() {
    const deviceName = document.getElementById("device-name").value;
    const charUuid = document.getElementById("char-uuid").value;

    if (!charUuid) {
      this.showStatus("Please enter characteristic UUID", "error");
      return;
    }

    this.showStatus("Connecting to device...", "info");

    try {
      await this.bluetooth.connect(deviceName || "");
      this.bluetooth.setCharacteristic(charUuid);

      // Enter draw mode on the LED matrix
      this.showStatus("Connected! Entering draw mode...", "info");
      await this.bluetooth.enterDrawMode();

      this.showStatus("Connected and ready! You can now draw and send to device.", "success");
    } catch (error) {
      this.showStatus(`Connection failed: ${error.message}`, "error");
      console.error(error);
    }
  }

  async handleDisconnect() {
    if (!this.bluetooth.isConnected()) {
      this.showStatus("No device connected", "error");
      return;
    }

    // Stop buffer processing during disconnect
    this.stopBufferProcessing();

    // Clear buffer on disconnect
    this.updateBuffer = [];

    this.showStatus("Disconnecting...", "info");
    this.bluetooth.disconnect();

    // Restart buffer processing after disconnect
    this.startBufferProcessing();

    this.showStatus("Disconnected successfully", "success");
  }

  showStatus(message, type = "info") {
    const statusEl = document.getElementById("status");
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }
}
