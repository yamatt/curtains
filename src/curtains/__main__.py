from argparse import Namespace, ArgumentParser

from .ble import scan


def get_args(args: list = None) -> Namespace:
    parser = ArgumentParser(
        description="Curtains: A CLI for managing LED curtains over BLE."
    )
    scanner = parser.add_subparsers(dest="command", help="List BLE devices.")
    scanner.add_parser("scan", default=scan)

    connect = parser.add_subparsers(dest="command", help="Connect to a BLE device.")
    connect.add_parser("connect", default=connect)
    connect.add_parser("device_address")
    return parser.parse_args(args)


if __name__ == "__main__":
    args = get_args()
    args.func(args)
