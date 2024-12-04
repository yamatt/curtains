from .packet import Packet, PacketType

class On(Packet):
    def __init__(self):
        super().__init__(PacketType.POWER, b"\x01")

class Off(Packet):
    def __init__(self):
        super().__init__(PacketType.POWER, b"\x00")
