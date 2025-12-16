from enum import Enum


class Packet:
    HEADER = b"\xaa"

    @classmethod
    def payload_from_string(cls, payload: str):
        return cls(bytes.fromhex(payload))

    def __init__(self, payload: bytes):
        """
        Initialize a Packet object.

        Parameters:
            data (bytes): The data payload of the packet.
        """
        self.payload = payload

    @property
    def checksum(self) -> int:
        """
        Generate checksum using the sum method (sum of bytes mod 256).

        Parameters:
            data (bytes): The byte string to calculate the checksum for.

        Returns:
            int: The checksum value (0-255).
        """
        # total = sum(self.payload) # old method
        total = sum(self.HEADER) + sum(self.payload)
        return total % 256

    @property
    def length(self) -> int:
        """
        Get the length of the packet.

        Returns:
            int: The length of the packet.
        """
        return len(self.payload)

    def to_bytes(self) -> bytes:
        """
        Convert the packet to a byte string.

        Returns:
            bytes: The byte string representation of the packet.
        """
        return self.HEADER + self.payload + self.checksum.to_bytes(1, byteorder="big")

    def to_str(self) -> str:
        """
        Convert the packet to a string representation.

        Returns:
            str: The string representation of the packet.
        """
        hex_bytes = [f"0x{byte:02X}" for byte in self.to_bytes()]
        return " ".join(hex_bytes)


class TypedPacket(Packet):

    PACKET_TYPE = None

    class Types(Enum):
        """
        Enum class representing different types of packets.
        """

        POWER = b"\x02"
        PRESET = b"\x03"
        PIXEL_CLEAR = b"\xd0"
        PIXEL_UPDATE = b"\xd1"
        PIXEL_BULK_UPDATE = b"\xda"

    @classmethod
    def from_args(cls, args):
        return cls(bytes.fromhex(args.payload))

    def __init__(self, payload: bytes):
        """
        Initialize a TypedPacket object.

        Parameters:
            payload (bytes): The data payload of the packet.
        """
        super().__init__(payload)

    def to_bytes(self) -> bytes:
        """
        Convert the packet to a byte string.

        Returns:
            bytes: The byte string representation of the packet.
        """
        return (
            self.HEADER
            + self.PACKET_TYPE.value
            + self.length.to_bytes(1, "big")
            + self.payload
            + self.checksum.to_bytes(1, byteorder="big")
        )

    def to_str(self) -> str:
        """
        Convert the packet to a string representation.

        Returns:
            str: The string representation of the packet.
        """
        hex_bytes = [f"0x{byte:02X}" for byte in self.to_bytes()]
        return " ".join(hex_bytes)


class PowerPacketBase(TypedPacket):
    PACKET_TYPE = TypedPacket.Types.POWER


class PixelCommandBase(TypedPacket):
    PACKET_TYPE = TypedPacket.Types.PIXEL_CLEAR

    def __init__(self):
        super().__init__(self.COMMAND)


class PixelClearPacket(PixelCommandBase):
    @property
    def payload(self) -> bytes:
        return b"\x00\x64\x64\x03"


class ImagePacket(Packet):
    """
    Subclass to handle the specific checksum logic and command structure
    of the LED Matrix.
    """

    CMD_BULK_WRITE = b"\xda"
    SUB_CMD_WRITE_LIST = b"\x01"

    @classmethod
    def create_pixel_update(cls, pixels: list[tuple[int, int]]) -> "ImagePacket":
        """
        Creates a packet to update specific pixels.

        Parameters:
            pixels: List of tuples [(index, color_byte), ...]
                    Example: [(0, 0xFF), (399, 0x84)]
        """
        # 1. Construct the Pixel Data: [Index High, Index Low, Color]
        data_bytes = bytearray()
        for index, color_val in pixels:
            # Ensure index is 0-399 (20x20)
            idx_h = (index >> 8) & 0xFF
            idx_l = index & 0xFF
            data_bytes.extend([idx_h, idx_l, color_val])

        # 2. Calculate Length Byte
        # Length = SubCmd (1) + Data Bytes
        packet_len = 1 + len(data_bytes)

        # 3. Assemble Payload: [Cmd, Len, SubCmd, Data...]
        # Note: Length is sent as a byte, so we pack it
        payload = (
            cls.CMD_BULK_WRITE
            + bytes([packet_len])
            + cls.SUB_CMD_WRITE_LIST
            + data_bytes
        )

        return cls(payload)

    @classmethod
    def create_image_frames(cls, image_path: str) -> list["LedMatrixPacket"]:
        """
        Reads an image, resizes it to 20x20, and generates the list
        of packets required to send it (handling chunking).
        """
        # 1. Process Image
        img = Image.open(image_path).convert("RGB")
        img = img.resize((20, 20))  # Force 20x20

        pixel_data = []

        # 2. Convert RGB to Device Format and build full pixel list
        # Iterate Row by Row (Row-Major)
        current_index = 0
        for y in range(20):
            for x in range(20):
                r, g, b = img.getpixel((x, y))

                # TODO: We need the specific lookup table for your device.
                # For now, we use a placeholder function.
                color_byte = cls._rgb_to_device_byte(r, g, b)

                pixel_data.append((current_index, color_byte))
                current_index += 1

        # 3. Chunking (Max 79 pixels per packet based on logs)
        # 238 bytes max payload / 3 bytes per pixel = ~79 pixels
        MAX_PIXELS_PER_PACKET = 79
        packets = []

        for i in range(0, len(pixel_data), MAX_PIXELS_PER_PACKET):
            chunk = pixel_data[i : i + MAX_PIXELS_PER_PACKET]
            packets.append(cls.create_pixel_update(chunk))

        return packets

    @staticmethod
    def _rgb_to_device_byte(r, g, b) -> int:
        """
        Placeholder mapper.
        Since we don't know the device's palette yet, we'll implement
        a simple threshold:
        - White (0xFF) if bright
        - Red (0x84) if reddish
        - Off (0x00) otherwise
        """
        if r > 200 and g > 200 and b > 200:
            return 0xFF  # White/On
        if r > 150 and g < 100 and b < 100:
            return 0x84  # Red-ish (from your logs)
        return 0x00  # Default off
