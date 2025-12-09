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
