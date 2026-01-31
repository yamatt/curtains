from functools import cached_property

from bleak import BleakClient

from curtains.messages import PixelClear, PixelDraw, PixelFillBase
from curtains.packet import Packet
from scenes.snowfall.grid import SnowflakeGrid


class Controller:
    def __init__(self, device_address: str, char_uuid: str):
        self.device_address = device_address
        self.char_uuid = char_uuid
        self.client = None

    async def connect(self):
        """Establish connection to the BLE device"""
        self.client = BleakClient(self.device_address)
        await self.client.connect()

    async def disconnect(self):
        """Disconnect from the BLE device"""
        if self.client and self.client.is_connected:
            await self.client.disconnect()

    async def write(self, packet: Packet):
        if not self.client or not self.client.is_connected:
            raise RuntimeError("Not connected to device")
        print(f"Writing packet: {packet.to_str()}")
        await self.client.write_gatt_char(self.char_uuid, packet.to_bytes())

    async def clear(self):
        await self.write(PixelClear())

    async def draw_mode(self):
        await self.write(PixelDraw())

    async def start(self):
        await self.connect()
        await self.clear()
        await self.draw_mode()


class SnowfallUpdatePacket(PixelFillBase):
    """
    The diff update packet for snowfall scene.
    """

    WHITE = PixelFillBase.Color.WHITE
    OFF = PixelFillBase.Color.OFF

    def __init__(self, update: list[bytes]):
        self.range = update
