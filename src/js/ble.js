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

  /**
   * Calculate checksum for packet payload
   */
  static calculateChecksum(payload) {
    return payload.reduce((sum, byte) => (sum + byte) % 256, 0);
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
  static buildPresetPacket(preset, brightness, speed = 10) {
    return Bluetooth.buildPacket(Bluetooth.PACKET_TYPE_PRESET, [0x02, preset, brightness, speed]);
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
      if (deviceName && deviceName.trim() !== "") {
        options = {
          acceptAllDevices: false,
          filters: [{ namePrefix: deviceName }],
          optionalServices: ["49535343-fe7d-4ae5-8fa9-9fafd205e455"] // Nordic UART Service UUID
        };
      } else {
        // No name filter - show all BLE devices
        options = {
          acceptAllDevices: true,
          optionalServices: ["49535343-fe7d-4ae5-8fa9-9fafd205e455"] // Nordic UART Service UUID
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
      // Get the service
      const services = await this.server.getPrimaryServices();
      
      // Find the characteristic across all services
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.uuid === this.characteristicUuid) {
            this.characteristic = char;
            this.service = service;
            return this.characteristic;
          }
        }
      }
      
      throw new Error(`Characteristic ${this.characteristicUuid} not found`);
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
  async setPreset(preset, brightness, speed = 10) {
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
}
