from argparse import Namespace, ArgumentParser

from .ble import scan, connect, read, update, listen, on, off, write
from .packet import PacketType

def get_args(args: list = None) -> Namespace:
    parser = ArgumentParser(
        description="Curtains: A CLI for managing LED curtains over BLE."
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands.", required=True)

    scanner_parser = subparsers.add_parser("scan", help="List BLE devices.")
    scanner_parser.set_defaults(func=scan)

    connect_parser = subparsers.add_parser("connect", help="Connect to a BLE device.")
    connect_parser.add_argument("device_address")
    connect_parser.set_defaults(func=connect)

    update_parser = subparsers.add_parser("read", help="Get data from Character.")
    update_parser.add_argument("device_address")
    update_parser.add_argument("char_uuid", help="Characteristic UUID")
    update_parser.set_defaults(func=read)

    update_parser = subparsers.add_parser("update", help="Write value to Character.")
    update_parser.add_argument("device_address")
    update_parser.add_argument("char_uuid", help="Characteristic UUID")
    update_parser.set_defaults(func=update)

    listen_parser = subparsers.add_parser("listen", help="Listen to notifications.")
    listen_parser.add_argument("device_address")
    listen_parser.add_argument("char_uuid", help="Characteristic UUID")
    listen_parser.set_defaults(func=listen)

    listen_parser = subparsers.add_parser("on", help="Turn the lights on.")
    listen_parser.add_argument("device_address")
    listen_parser.add_argument("char_uuid", help="Characteristic UUID")
    listen_parser.set_defaults(func=on)

    listen_parser = subparsers.add_parser("off", help="Turn the lights off.")
    listen_parser.add_argument("device_address")
    listen_parser.add_argument("char_uuid", help="Characteristic UUID")
    listen_parser.set_defaults(func=off)

    listen_parser = subparsers.add_parser("write", help="Write data to characteristic.")
    listen_parser.add_argument("device_address")
    listen_parser.add_argument("char_uuid", help="Characteristic UUID")
    listen_parser.add_argument("type", choices=PacketType.__members__.keys(), type=str.upper)
    listen_parser.add_argument("payload", help="Payload as hex. E.g.: 0201030d")
    listen_parser.set_defaults(func=write)


    return parser.parse_args(args)
