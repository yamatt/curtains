
from enum import Enum

class PacketType(Enum):
    """
    Enum class representing different types of packets.
    """
    POWER = b"\x02"
    PRESET = b"\03"

class Packet:
    HEADER = b"\xaa"
    FOOTER = b"\x64"

    @classmethod
    def from_args(cls, args):
        return cls(
            getattr(PacketType, args.type),
            bytes.fromhex(args.payload)
        )

    def __init__(self, packet_type: PacketType, payload: bytes):
        """
        Initialize a Packet object.

        Parameters:
            packet_type (PacketTypes): The type of packet.
            data (bytes): The data payload of the packet.
        """
        self.packet_type = packet_type
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
        checksum = sum(self.payload) % 256
        return checksum

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
        return self.HEADER + self.packet_type.value + self.length.to_bytes(1, 'big') + self.payload + self.checksum.to_bytes(1, byteorder='big')


    def to_str(self) -> str:
        """
        Convert the packet to a string representation.

        Returns:
            str: The string representation of the packet.
        """
        hex_bytes = [f'0x{byte:02X}' for byte in self.to_bytes()]
        return ' '.join(hex_bytes)
