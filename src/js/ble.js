export default class Bluetooth {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.characteristicUuid = null;
  }

  // Packet constants
  static HEADER = 0xaa;
  static FOOTER = 0x64;
  static PACKET_TYPE_POWER = 0x02;
  static PACKET_TYPE_PRESET = 0x03;
  static PACKET_TYPE_PIXEL_UPDATE = 0xd1;

  /**
   * Calculate checksum for packet payload
   */
  static calculateChecksum(payload) {
    return payload.reduce((sum, byte) => (sum + byte) % 256, 0);
  }

  /**
   * Calculate checksum including header for pixel packets
   */
  static calculateChecksumWithHeader(payload) {
    return (Bluetooth.HEADER + payload.reduce((sum, byte) => sum + byte, 0)) % 256;
  }

  /**
   * Build a packet with header, type, length, payload, checksum
   */
  static buildPacket(packetType, payload) {
    const length = payload.length;
    const checksum = Bluetooth.calculateChecksum(payload);
    return new Uint8Array([
      Bluetooth.HEADER,
      packetType,
      length,
      ...payload,
      checksum
    ]);
  }

  /**
   * Build ON command packet
   */
  static buildOnPacket() {
    return Bluetooth.buildPacket(Bluetooth.PACKET_TYPE_POWER, [0x01]);
  }

  /**
   * Build OFF command packet
   */
  static buildOffPacket() {
    return Bluetooth.buildPacket(Bluetooth.PACKET_TYPE_POWER, [0x00]);
  }

  /**
   * Build PRESET command packet
   */
  static buildPresetPacket(preset, brightness, speed) {
    // Only include speed byte if explicitly provided
    const payload = speed !== undefined
      ? [0x02, preset, brightness, speed]
      : [0x02, preset, brightness];
    return Bluetooth.buildPacket(Bluetooth.PACKET_TYPE_PRESET, payload);
  }

  /**
   * Build PAUSE command packet
   */
  static buildPausePacket() {
    return Bluetooth.buildPacket(Bluetooth.PACKET_TYPE_PRESET, [0x02, 0x00]);
  }

  /**
   * Request Bluetooth device and connect
   */
  async connect(deviceName = "Hello Fairy") {
    try {
      // Request device - accept all devices to allow any BLE device to be shown
      // If a device name is provided and not empty, use it as a prefix filter
      let options;
      // Include multiple common service UUIDs to ensure we can access the characteristics
      const services = [
        "49535343-fe7d-4ae5-8fa9-9fafd205e455",  // Custom service UUID
        "0000180a-0000-1000-8000-00805f9b34fb",  // Device Information Service
        "0000180f-0000-1000-8000-00805f9b34fb",  // Battery Service
        "generic_access",                         // Generic Access
        "generic_attribute"                       // Generic Attribute
      ];

      if (deviceName && deviceName.trim() !== "") {
        options = {
          acceptAllDevices: false,
          filters: [{ namePrefix: deviceName }],
          optionalServices: services
        };
      } else {
        // No name filter - show all BLE devices
        options = {
          acceptAllDevices: true,
          optionalServices: services
        };
      }

      this.device = await navigator.bluetooth.requestDevice(options);

      // Connect to GATT server
      this.server = await this.device.gatt.connect();

      return true;
    } catch (error) {
      console.error("Connection failed:", error);
      throw error;
    }
  }

  /**
   * Set the characteristic UUID to use for commands
   */
  setCharacteristic(uuid) {
    this.characteristicUuid = uuid;
  }

  /**
   * Get the characteristic for writing commands
   */
  async getCharacteristic() {
    if (!this.characteristic || this.characteristic.uuid !== this.characteristicUuid) {
      try {
        // Get all primary services
        const services = await this.server.getPrimaryServices();

        // Find the characteristic across all services
        for (const service of services) {
          try {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.uuid === this.characteristicUuid) {
                this.characteristic = char;
                this.service = service;
                return this.characteristic;
              }
            }
          } catch (error) {
            // Skip services that we can't access
            console.warn(`Could not get characteristics for service ${service.uuid}:`, error);
          }
        }
      } catch (error) {
        console.error("Error getting services:", error);
      }

      throw new Error(`Characteristic ${this.characteristicUuid} not found. The device may not support this characteristic, or you may need to add its service UUID to the optionalServices list in the connect() method.`);
    }
    return this.characteristic;
  }

  /**
   * Write packet to characteristic
   */
  async writePacket(packet) {
    if (!this.server || !this.server.connected) {
      throw new Error("Not connected to device");
    }

    if (!this.characteristicUuid) {
      throw new Error("Characteristic UUID not set");
    }

    const characteristic = await this.getCharacteristic();
    await characteristic.writeValue(packet);
  }

  /**
   * Turn curtains on
   */
  async turnOn() {
    const packet = Bluetooth.buildOnPacket();
    await this.writePacket(packet);
  }

  /**
   * Turn curtains off
   */
  async turnOff() {
    const packet = Bluetooth.buildOffPacket();
    await this.writePacket(packet);
  }

  /**
   * Set preset animation
   */
  async setPreset(preset, brightness, speed) {
    const packet = Bluetooth.buildPresetPacket(preset, brightness, speed);
    await this.writePacket(packet);
  }

  /**
   * Pause animation
   */
  async pause() {
    const packet = Bluetooth.buildPausePacket();
    await this.writePacket(packet);
  }

  /**
   * Set solid color
   * @param {number} hue - Hue (0-360)
   * @param {number} saturation - Saturation (0-1000)
   * @param {number} brightness - Brightness/Value (0-1000)
   */
  async setSolidColor(hue, saturation, brightness) {
    // Convert hue to 2 bytes (big-endian)
    const hueBytes = hue.toString(16).padStart(4, '0');
    const satBytes = saturation.toString(16).padStart(4, '0');
    const brightBytes = brightness.toString(16).padStart(4, '0');

    const payload = new Uint8Array([
      0x01, // Set Color command
      parseInt(hueBytes.slice(0, 2), 16),
      parseInt(hueBytes.slice(2, 4), 16),
      parseInt(satBytes.slice(0, 2), 16),
      parseInt(satBytes.slice(2, 4), 16),
      parseInt(brightBytes.slice(0, 2), 16),
      parseInt(brightBytes.slice(2, 4), 16)
    ]);

    const packet = Bluetooth.buildColorPacket(payload);
    await this.writePacket(packet);
  }

  /**
   * Build color packet
   */
  static buildColorPacket(payload) {
    return Bluetooth.buildPacket(0x03, payload);
  }

  /**
   * Build a packet with header, type, length, payload, checksum
   */
  static buildPacket(packetType, payload) {
    const length = payload.length;
    const checksum = Bluetooth.calculateChecksum(payload);
    return new Uint8Array([
      Bluetooth.HEADER,
      packetType,
      length,
      ...payload,
      checksum
    ]);
  }

  /**
   * Disconnect from device
   */
  disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.device && this.device.gatt.connected;
  }

  /**
   * Build a pixel update packet
   * @param {number} x - X coordinate (0-19)
   * @param {number} y - Y coordinate (0-19)
   * @param {number} colorByte - Color byte value
   */
  static buildPixelUpdatePacket(x, y, colorByte) {
    // Calculate pixel index (row-major order)
    const index = y * 20 + x;

    // Build payload: [index_high, index_low, color]
    const indexHigh = (index >> 8) & 0xFF;
    const indexLow = index & 0xFF;
    const payload = [indexHigh, indexLow, colorByte];

    // Build the packet with proper checksum
    const packetType = Bluetooth.PACKET_TYPE_PIXEL_UPDATE;
    const length = payload.length;
    const fullPayload = [packetType, length, ...payload];
    const checksum = Bluetooth.calculateChecksumWithHeader(fullPayload);

    return new Uint8Array([
      Bluetooth.HEADER,
      ...fullPayload,
      checksum
    ]);
  }

  /**
   * Set a single pixel to a color
   * @param {number} x - X coordinate (0-19)
   * @param {number} y - Y coordinate (0-19)
   * @param {number} colorByte - Color byte value
   */
  async setPixel(x, y, colorByte) {
    const packet = Bluetooth.buildPixelUpdatePacket(x, y, colorByte);
    await this.writePacket(packet);
  }

  /**
   * Color constants for pixel drawing
   */
  static PixelColors = {
    RED: 0x00,
    ORANGE: 0x08,
    YELLOW: 0x20,
    GREEN: 0x38,
    BLUE: 0x50,
    PURPLE: 0x88,
    WHITE: 0xFF,
    OFF: 0xFE
  };

  /**
   * Convert HSL to pixel color byte
   * @param {number} hue - Hue (0-360)
   * @param {number} saturation - Saturation (0-100)
   * @param {number} lightness - Lightness (0-100)
   */
  static hslToPixelColor(hue, saturation, lightness) {
    // Handle white
    if (saturation < 10 && lightness > 90) {
      return Bluetooth.PixelColors.WHITE;
    }

    // Handle off/black
    if (lightness < 10) {
      return Bluetooth.PixelColors.OFF;
    }

    // Map hue to approximate color byte
    // The device appears to use a compressed hue range (0-180)
    const DEVICE_HUE_RANGE = 180;
    const normalizedHue = (hue / 360) * DEVICE_HUE_RANGE;
    return Math.round(normalizedHue) & 0xFF;
  }

  /**
   * Send PixelClear command to clear all pixels on the LED matrix
   */
  static buildPixelClearPacket() {
    // PixelClear command: 0x00 0x64 0x64 0x03
    const packetType = 0xd0; // Pixel command type
    const payload = [0x00, 0x64, 0x64, 0x03];
    const length = payload.length;
    const checksum = Bluetooth.calculateChecksum(payload);
    return new Uint8Array([
      Bluetooth.HEADER,
      packetType,
      length,
      ...payload,
      checksum
    ]);
  }

  async clearPixels() {
    const packet = Bluetooth.buildPixelClearPacket();
    await this.writePacket(packet);
  }

  /**
   * Send PixelDraw command to enter drawing mode
   */
  static buildPixelDrawPacket() {
    // PixelDraw command: 0x00 0x64 0x64 0x00
    const packetType = 0xd0; // Pixel command type
    const payload = [0x00, 0x64, 0x64, 0x00];
    const length = payload.length;
    const checksum = Bluetooth.calculateChecksum(payload);
    return new Uint8Array([
      Bluetooth.HEADER,
      packetType,
      length,
      ...payload,
      checksum
    ]);
  }

  async enterDrawMode() {
    const packet = Bluetooth.buildPixelDrawPacket();
    await this.writePacket(packet);
  }
}
