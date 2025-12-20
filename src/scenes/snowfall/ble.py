from functools import cached_property

from bleak import BleakClient

from curtains.messages import PixelClear, PixelDraw, PixelFillBase
from curtains.packet import Packet
from scenes.snowfall.grid import SnowflakeGrid


class Controller:
    def __init__(self, device_address: str, char_uuid: str):
        self.device_address = device_address
        self.char_uuid = char_uuid

    @cached_property
    def client(self):
        return BleakClient(self.device_address)

    def write(self, packet: Packet):
        self.client.write_gatt_char(self.char_uuid, packet.to_bytes())

    def clear(self):
        self.write(PixelClear())

    def draw_mode(self):
        self.write(PixelDraw())

    def start(self):
        self.clear()
        self.draw_mode()


class SnowfallUpdatePacket(PixelFillBase):
    """
    The diff update packet for snowfall scene.
    """

    WHITE = PixelFillBase.Color.WHITE
    OFF = PixelFillBase.Color.OFF

    def __init__(self, update: list[bytes]):
        self.range = update
