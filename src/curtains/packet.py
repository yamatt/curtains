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
