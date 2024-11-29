import asyncio
from time import sleep
import base64

from bleak import BleakClient, BleakScanner


def scan(args):
    asyncio.run(discover_devices())


def connect(args):
    asyncio.run(list_services(args.device_address))

def read(args):
    asyncio.run(read_services(args.device_address, args.char_uuid))

def update(args):
    asyncio.run(write_services(args.device_address, args.char_uuid))

def listen(args):
    asyncio.run(listen_service(args.device_address, args.char_uuid))


async def listen_service(address: str, char_uuid: str):
    def notification_handler(sender, data):
        print(f"From {sender}: {data}")


    async with BleakClient(address) as client:
        await client.start_notify(char_uuid, notification_handler)
        sleep(30)

async def discover_devices():
    devices = await BleakScanner.discover()
    for device in devices:
        print(f"{device.address}: {device.name}")

async def read_services(address: str, char_uuid: str):
    async with BleakClient(address) as client:
        value = await client.read_gatt_char(char_uuid)
        print("Read value:", value)

async def list_services(address: str):
    async with BleakClient(address) as client:
        # Example: Read available services
        for service in client.services:
            print(f"Service: {service.uuid}")
            for characteristic in service.characteristics:
                print(f"\tCharacteristic: {characteristic.uuid}")
                for property in characteristic.properties:
                    print(f"\t\tProperty: {property}")

        # Example: Write data to a characteristic (replace UUID and data)
        characteristic_uuid = "5833ff02-9b8b-5191-6142-22a4536ef123"
        data = bytes([0x01, 0xFF, 0x00])  # Example: RGB color
        await client.write_gatt_char(characteristic_uuid, data)

async def write_services(address: str, char_uuid: str):
    data = bytes([0x00, 0xFF, 0x00])  # Example: RGB color

    async with BleakClient(address) as client:
        await client.write_gatt_char(char_uuid, data)
