from .packet import Packet, PacketType

class On(Packet):
    def __init__(self):
        super().__init__(PacketType.POWER, b"\x01")

class Off(Packet):
    def __init__(self):
        super().__init__(PacketType.POWER, b"\x00")

class Preset(Packet):
    PRESET_ANIMATION = b"\x02"
    @classmethod
    def from_args(cls, args):
        return cls(args.preset, args.brightness)

    def __init__(self, preset: int, brightness: int):
        super().__init__(PacketType.PRESET, self.PRESET_ANIMATION + preset.to_bytes(1, 'big') + brightness.to_bytes(1, 'big'))
