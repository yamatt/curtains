from argparse import Namespace, ArgumentParser

from .ble import scan, connect, read, update, listen

from .commands import (
    on,
    off,
    write,
    preset,
    pause,
    rgb,
    pixel,
    draw,
    clear,
    fill,
    image,
)


def get_args(args: list = None) -> Namespace:
    parser = ArgumentParser(
        description="Curtains: A CLI for managing LED curtains over BLE."
    )
    # Common options used by most commands
    parser.add_argument("device_address", help="BLE device MAC address")
    parser.add_argument(
        "--char-uuid",
        "-c",
        dest="char_uuid",
        help="Characteristic UUID (defaults to the device's control UUID)",
        default="49535343-8841-43f4-a8d4-ecbe34729bb3",
    )
    subparsers = parser.add_subparsers(
        dest="command", help="Available commands.", required=True
    )

    scanner_parser = subparsers.add_parser("scan", help="List BLE devices.")
    scanner_parser.set_defaults(func=scan)

    connect_parser = subparsers.add_parser("connect", help="Connect to a BLE device.")
    connect_parser.set_defaults(func=connect)

    update_parser = subparsers.add_parser("read", help="Get data from Character.")
    update_parser.set_defaults(func=read)

    update_parser = subparsers.add_parser("update", help="Write value to Character.")
    update_parser.add_argument("payload", help="Characteristic UUID")
    update_parser.set_defaults(func=update)

    listen_parser = subparsers.add_parser("listen", help="Listen to notifications.")
    listen_parser.set_defaults(func=listen)

    listen_parser = subparsers.add_parser("on", help="Turn the lights on.")
    listen_parser.set_defaults(func=on)

    listen_parser = subparsers.add_parser("off", help="Turn the lights off.")
    listen_parser.set_defaults(func=off)

    listen_parser = subparsers.add_parser("write", help="Write data to characteristic.")
    listen_parser.add_argument("payload", help="Payload as hex. E.g.: 0201030d")
    listen_parser.set_defaults(func=write)

    listen_parser = subparsers.add_parser("preset", help="Select preset.")
    listen_parser.add_argument("preset", help="Preset from 1 to 109", type=int)
    listen_parser.add_argument(
        "-b",
        "--brightness",
        help="Brightness level from 0 to 255",
        required=False,
        default=255,
        type=int,
    )
    listen_parser.add_argument(
        "-s",
        "--speed",
        help="Animation speed from 0 to 255 (default: 10)",
        required=False,
        default=10,
        type=int,
    )
    listen_parser.set_defaults(func=preset)

    listen_parser = subparsers.add_parser("pause", help="Pause preset animation.")
    listen_parser.set_defaults(func=pause)

    listen_parser = subparsers.add_parser("rgb", help="Set to one whole colour.")
    listen_parser.add_argument("red", type=int, help="Red component (0-255)")
    listen_parser.add_argument("green", type=int, help="Green component (0-255)")
    listen_parser.add_argument("blue", type=int, help="Blue component (0-255)")
    listen_parser.set_defaults(func=rgb)

    pixel_parser = subparsers.add_parser("pixel", help="Pixel operations.")

    pixel_subparsers = pixel_parser.add_subparsers(
        dest="pixel_command", help="Pixel subcommands.", required=True
    )

    # single: set one pixel
    single_parser = pixel_subparsers.add_parser(
        "single", help="Set a single pixel to a color."
    )
    single_parser.add_argument("x", help="X coordinate (0-19)", type=int)
    single_parser.add_argument("y", help="Y coordinate (0-19)", type=int)
    single_parser.add_argument(
        "color",
        choices=[
            "red",
            "orange",
            "yellow",
            "green",
            "blue",
            "purple",
            "white",
            "off",
        ],
        help="Color",
    )
    single_parser.set_defaults(func=pixel)

    # clear: clear drawing mode (or clear buffer)
    clear_parser = pixel_subparsers.add_parser(
        "clear", help="Clear pixels (controller-specific)."
    )
    clear_parser.set_defaults(func=clear)

    # fill: fill pixels starting from offset
    fill_parser = pixel_subparsers.add_parser(
        "fill", help="Fill pixels from an offset with a color."
    )
    fill_parser.add_argument(
        "color",
        nargs="?",
        default="off",
        choices=[
            "red",
            "orange",
            "yellow",
            "green",
            "blue",
            "purple",
            "white",
            "off",
            "random",
        ],
        help="Color (default: off). Use 'random' to fill with random hues.",
    )
    fill_parser.add_argument(
        "--offset", "-o", help="Starting offset (0-399)", type=int, default=0
    )
    fill_parser.set_defaults(func=fill)

    # draw: enter drawing mode
    draw_parser = pixel_subparsers.add_parser("image", help="Write image to pixels.")
    draw_parser.add_argument("image_path", help="Path to the image file.")
    draw_parser.set_defaults(func=image)

    # draw: enter drawing mode
    draw_parser = pixel_subparsers.add_parser("draw", help="Enter drawing mode.")
    draw_parser.set_defaults(func=draw)

    return parser.parse_args(args)
