import Bluetooth from "./ble.js";

export default class Controls {
  constructor(el) {
    this.el = el;
    this.bluetooth = new Bluetooth();
    this.statusEl = null;
  }

  init() {
    // Create status display element
    this.createStatusDisplay();

    // Handle form submission
    this.el.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(event.target);
      const submitter = event.submitter;

      try {
        if (submitter.name === "connect") {
          await this.handleConnect(formData);
        } else if (submitter.name === "disconnect") {
          await this.handleDisconnect();
        } else if (submitter.name === "power") {
          await this.handlePower(submitter.value);
        } else if (submitter.name === "pause") {
          await this.handlePause();
        } else if (submitter.name === "preset_apply") {
          await this.handlePreset(formData);
        } else if (submitter.name === "color_apply") {
          await this.handleColor(formData);
        }
      } catch (error) {
        this.showStatus(`Error: ${error.message}`, "error");
        console.error(error);
      }
    });

    // Handle preset input change - auto-apply when changed
    this.el.preset.addEventListener("change", async (event) => {
      if (this.bluetooth.isConnected()) {
        try {
          await this.handlePresetFromInput();
        } catch (error) {
          this.showStatus(`Error: ${error.message}`, "error");
          console.error(error);
        }
      }
    });

    // Handle brightness input change - auto-apply when changed
    const brightnessInput = this.el.querySelector('[name="brightness"]');
    if (brightnessInput) {
      brightnessInput.addEventListener("change", async (event) => {
        if (this.bluetooth.isConnected()) {
          try {
            await this.handlePresetFromInput();
          } catch (error) {
            this.showStatus(`Error: ${error.message}`, "error");
            console.error(error);
          }
        }
      });
    }

    // Handle color input change - auto-apply when changed
    const colorInput = this.el.querySelector('[name="color"]');
    if (colorInput) {
      colorInput.addEventListener("change", async (event) => {
        if (this.bluetooth.isConnected()) {
          try {
            await this.handleColorFromInput();
          } catch (error) {
            this.showStatus(`Error: ${error.message}`, "error");
            console.error(error);
          }
        }
      });
    }

    // Handle color brightness input change - auto-apply when changed
    const colorBrightnessInput = this.el.querySelector('[name="color-brightness"]');
    if (colorBrightnessInput) {
      colorBrightnessInput.addEventListener("change", async (event) => {
        if (this.bluetooth.isConnected()) {
          try {
            await this.handleColorFromInput();
          } catch (error) {
            this.showStatus(`Error: ${error.message}`, "error");
            console.error(error);
          }
        }
      });
    }

    this.showStatus("Ready. Click Connect to begin.", "info");
  }

  createStatusDisplay() {
    this.statusEl = document.createElement("div");
    this.statusEl.id = "status";
    this.statusEl.style.padding = "10px";
    this.statusEl.style.marginBottom = "10px";
    this.statusEl.style.border = "1px solid #ccc";
    this.statusEl.style.borderRadius = "4px";
    this.statusEl.style.backgroundColor = "#f5f5f5";
    this.el.insertBefore(this.statusEl, this.el.firstChild);
  }

  showStatus(message, type = "info") {
    this.statusEl.textContent = message;

    // Set color based on type
    const colors = {
      info: "#0066cc",
      success: "#008800",
      error: "#cc0000",
      warning: "#ff8800"
    };

    this.statusEl.style.color = colors[type] || colors.info;
  }

  async handleConnect(formData) {
    const deviceAddress = formData.get("device_address");
    const characteristicUuid = formData.get("characteristic_uuid");

    if (!characteristicUuid) {
      this.showStatus("Please enter characteristic UUID", "error");
      return;
    }

    this.showStatus("Connecting to device...", "info");

    // Pass the device address (empty string if not provided to show all devices)
    await this.bluetooth.connect(deviceAddress || "");
    this.bluetooth.setCharacteristic(characteristicUuid);

    this.showStatus("Connected successfully!", "success");
  }

  async handleDisconnect() {
    if (!this.bluetooth.isConnected()) {
      this.showStatus("No device connected", "warning");
      return;
    }

    this.showStatus("Disconnecting...", "info");
    this.bluetooth.disconnect();
    this.showStatus("Disconnected successfully. You can now connect to a different device.", "success");
  }

  async handlePower(value) {
    if (!this.bluetooth.isConnected()) {
      this.showStatus("Please connect to device first", "error");
      return;
    }

    this.showStatus(`Turning ${value.toLowerCase()}...`, "info");

    if (value === "On") {
      await this.bluetooth.turnOn();
      this.showStatus("Turned on successfully", "success");
    } else if (value === "Off") {
      await this.bluetooth.turnOff();
      this.showStatus("Turned off successfully", "success");
    }
  }

  async handlePause() {
    if (!this.bluetooth.isConnected()) {
      this.showStatus("Please connect to device first", "error");
      return;
    }

    this.showStatus("Pausing animation...", "info");
    await this.bluetooth.pause();
    this.showStatus("Animation paused", "success");
  }

  async handlePreset(formData) {
    if (!this.bluetooth.isConnected()) {
      this.showStatus("Please connect to device first", "error");
      return;
    }

    const preset = parseInt(formData.get("preset"), 10);
    const brightness = parseInt(formData.get("brightness") || "255", 10);

    if (isNaN(preset) || preset < 1 || preset > 109) {
      this.showStatus("Preset must be between 1 and 109", "error");
      return;
    }

    if (isNaN(brightness) || brightness < 0 || brightness > 255) {
      this.showStatus("Brightness must be between 0 and 255", "error");
      return;
    }

    this.showStatus(`Setting preset ${preset} with brightness ${brightness}...`, "info");
    await this.bluetooth.setPreset(preset, brightness);
    this.showStatus(`Preset ${preset} applied successfully`, "success");
  }

  async handlePresetFromInput() {
    const preset = parseInt(this.el.preset.value, 10);
    const brightnessInput = this.el.querySelector('[name="brightness"]');
    const brightness = brightnessInput ? parseInt(brightnessInput.value, 10) : 255;

    if (isNaN(preset) || preset < 1 || preset > 109) {
      return;
    }

    if (isNaN(brightness) || brightness < 0 || brightness > 255) {
      return;
    }

    this.showStatus(`Setting preset ${preset} with brightness ${brightness}...`, "info");
    await this.bluetooth.setPreset(preset, brightness);
    this.showStatus(`Preset ${preset} applied successfully`, "success");
  }

  hexToHsv(hex) {
    // Convert hex color to HSV
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / delta + 2) / 6;
      else h = ((r - g) / delta + 4) / 6;
    }

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 1000),
      v: Math.round(v * 1000)
    };
  }

  async handleColor(formData) {
    if (!this.bluetooth.isConnected()) {
      this.showStatus("Please connect to device first", "error");
      return;
    }

    const colorHex = formData.get("color") || "#FF0000";
    const colorBrightness = parseInt(formData.get("color-brightness") || "1000", 10);

    if (colorBrightness < 0 || colorBrightness > 1000) {
      this.showStatus("Color brightness must be between 0 and 1000", "error");
      return;
    }

    const hsv = this.hexToHsv(colorHex);
    this.showStatus(`Setting color ${colorHex} with brightness ${colorBrightness}...`, "info");
    await this.bluetooth.setSolidColor(hsv.h, hsv.s, colorBrightness);
    this.showStatus(`Color applied successfully`, "success");
  }

  async handleColorFromInput() {
    const colorInput = this.el.querySelector('[name="color"]');
    const colorHex = colorInput ? colorInput.value : "#FF0000";
    const colorBrightnessInput = this.el.querySelector('[name="color-brightness"]');
    const colorBrightness = colorBrightnessInput ? parseInt(colorBrightnessInput.value, 10) : 1000;

    if (colorBrightness < 0 || colorBrightness > 1000) {
      return;
    }

    const hsv = this.hexToHsv(colorHex);
    this.showStatus(`Setting color ${colorHex} with brightness ${colorBrightness}...`, "info");
    await this.bluetooth.setSolidColor(hsv.h, hsv.s, colorBrightness);
    this.showStatus(`Color applied successfully`, "success");
  }
