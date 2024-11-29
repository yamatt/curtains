from bleak import discover, BleakClient


def scan(args):
    devices = discover()

    for device in devices:
        print(f"{device.address}: {device.name}")


def get_client(args):
    return BleakClient(args.device_address)


def connect(args):
    with get_client(args) as client:
        print(f"Connected to {args.device_address}")


def get_services(args):
    client = get_client(args)
    for service in client.services:
        print(f"Service: {service}")
