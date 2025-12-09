from .packet import Packet, PacketType


class On(Packet):
    def __init__(self):
        super().__init__(PacketType.POWER, b"\x01")


class Off(Packet):
    def __init__(self):
        super().__init__(PacketType.POWER, b"\x00")


class Pause(Packet):
    def __init__(self):
        super().__init__(PacketType.PRESET, b"\x02\x00")


class Preset(Packet):
    PRESET_ANIMATION_MODE = b"\x02"

    @classmethod
    def from_args(cls, args):
        speed = getattr(args, "speed", 10)  # Default speed if not provided
        return cls(args.preset, args.brightness, speed)

    def __init__(self, preset_id: int, brightness: int, speed: int = 10):
        # Speed parameter appears to be a 4th byte based on NOTES.md examples
        # Default speed of 10 (0x0a) for backward compatibility
        super().__init__(
            PacketType.PRESET,
            self.PRESET_ANIMATION_MODE
            + preset_id.to_bytes(1, "big")
            + brightness.to_bytes(1, "big")
            + speed.to_bytes(1, "big"),
        )
