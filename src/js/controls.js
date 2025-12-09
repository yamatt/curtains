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

    // Handle speed input change - auto-apply when changed
    const speedInput = this.el.querySelector('[name="speed"]');
    if (speedInput) {
      speedInput.addEventListener("change", async (event) => {
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
    const speed = parseInt(formData.get("speed") || "10", 10);
    
    if (isNaN(preset) || preset < 1 || preset > 109) {
      this.showStatus("Preset must be between 1 and 109", "error");
      return;
    }
    
    if (isNaN(brightness) || brightness < 0 || brightness > 255) {
      this.showStatus("Brightness must be between 0 and 255", "error");
      return;
    }
    
    if (isNaN(speed) || speed < 0 || speed > 255) {
      this.showStatus("Speed must be between 0 and 255", "error");
      return;
    }

    this.showStatus(`Setting preset ${preset} with brightness ${brightness} and speed ${speed}...`, "info");
    await this.bluetooth.setPreset(preset, brightness, speed);
    this.showStatus(`Preset ${preset} applied successfully`, "success");
  }

  async handlePresetFromInput() {
    const preset = parseInt(this.el.preset.value, 10);
    const brightnessInput = this.el.querySelector('[name="brightness"]');
    const brightness = brightnessInput ? parseInt(brightnessInput.value, 10) : 255;
    const speedInput = this.el.querySelector('[name="speed"]');
    const speed = speedInput ? parseInt(speedInput.value, 10) : 10;
    
    if (isNaN(preset) || preset < 1 || preset > 109) {
      return;
    }
    
    if (isNaN(brightness) || brightness < 0 || brightness > 255) {
      return;
    }
    
    if (isNaN(speed) || speed < 0 || speed > 255) {
      return;
    }

    this.showStatus(`Setting preset ${preset} with brightness ${brightness} and speed ${speed}...`, "info");
    await this.bluetooth.setPreset(preset, brightness, speed);
    this.showStatus(`Preset ${preset} applied successfully`, "success");
  }
}
