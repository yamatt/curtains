import asyncio
from time import sleep
import base64

from bleak import BleakClient, BleakScanner

from .logger import log
from .packet import Packet, TypedPacket


def scan(args):
    asyncio.run(discover_devices())


def connect(args):
    asyncio.run(list_services(args.device_address))


def read(args):
    asyncio.run(read_services(args.device_address, args.char_uuid))


def update(args):
    asyncio.run(
        write_services(args.device_address, args.char_uuid, TypedPacket.from_args(args))
    )


def listen(args):
    asyncio.run(listen_service(args.device_address, args.char_uuid))


def send(device_address, char_uuid, packet):
    asyncio.run(
        write_services(
            device_address,
            char_uuid,
            packet,
        )
    )


async def listen_service(address: str, char_uuid: str):
    def notification_handler(sender, data):
        print(f"From {sender}: {data}")

    async with BleakClient(address) as client:
        await client.start_notify(char_uuid, notification_handler)
        sleep(30)


async def discover_devices():
    devices = await BleakScanner.discover()
    for device in devices:
        log.info("DISCOVER", address=device.address, name=device.name)


async def read_services(address: str, char_uuid: str):
    async with BleakClient(address) as client:
        value = await client.read_gatt_char(char_uuid)
        log.info("READ SERVICE", value=value)


async def list_services(address: str):
    async with BleakClient(address) as client:
        # Example: Read available services
        for service in client.services:
            log.info("SERVICE", uuid=service.uuid)
            for characteristic in service.characteristics:
                log.info("CHARACTERISTIC", uuid=characteristic.uuid)
                for property in characteristic.properties:
                    log.info("PROPERTY", property=property)


async def write_services(address: str, char_uuid: str, packet: Packet):
    async with BleakClient(address) as client:
        log.debug("WRITING PACKET", packet_s=packet.to_str())
        await client.write_gatt_char(char_uuid, packet.to_bytes())
