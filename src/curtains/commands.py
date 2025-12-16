from .packet import Packet, TypedPacket
from .messages import (
    FullColor,
    On,
    Off,
    PixelUpdate,
    PixelClear,
    PixelFill,
    PixelDraw,
    Preset,
    Pause,
)

from .ble import send


def on(args):
    send(args.device_address, args.char_uuid, On())


def off(args):
    send(args.device_address, args.char_uuid, Off())


def write(args):
    send(
        args.device_address,
        args.char_uuid,
        Packet.payload_from_string(args.payload),
    )


def preset(args):
    send(args.device_address, args.char_uuid, Preset.from_args(args))


def pause(args):
    send(args.device_address, args.char_uuid, Pause())


def rgb(args):
    send(
        args.device_address,
        args.char_uuid,
        FullColor.from_rgb(args.red, args.green, args.blue),
    )


def pixel(args):
    # Map color strings to Enum values
    color_map = {
        "red": PixelUpdate.Color.RED,
        "orange": PixelUpdate.Color.ORANGE,
        "yellow": PixelUpdate.Color.YELLOW,
        "green": PixelUpdate.Color.GREEN,
        "blue": PixelUpdate.Color.BLUE,
        "purple": PixelUpdate.Color.PURPLE,
        "white": PixelUpdate.Color.WHITE,
        "off": PixelUpdate.Color.OFF,
    }

    if args.pixel_command == "single":
        color = color_map[args.color]
        packet = PixelUpdate(args.x, args.y, color)
    elif args.pixel_command == "clear":
        packet = PixelClear()
    elif args.pixel_command == "fill":
        color = color_map[args.color]
        offset = getattr(args, "offset", 0)
        packet = PixelFill(color, offset)
    elif args.pixel_command == "draw":
        packet = PixelDraw()
    else:
        raise ValueError(f"Unknown pixel subcommand: {args.pixel_command}")

    send(args.device_address, args.char_uuid, packet)


def draw(args):
    """Enter drawing mode."""
    send(args.device_address, args.char_uuid, PixelDraw())


def clear(args):
    """Clear pixels (controller-specific)."""
    send(args.device_address, args.char_uuid, PixelClear())


def fill(args):
    """Fill pixels from an offset with a color."""
    # Map color strings to Enum values
    color_map = {
        "red": PixelFill.Color.RED,
        "orange": PixelFill.Color.ORANGE,
        "yellow": PixelFill.Color.YELLOW,
        "green": PixelFill.Color.GREEN,
        "blue": PixelFill.Color.BLUE,
        "purple": PixelFill.Color.PURPLE,
        "white": PixelFill.Color.WHITE,
        "off": PixelFill.Color.OFF,
    }
    color = color_map[args.color]
    offset = getattr(args, "offset", 0)
    packet = PixelFill(color, offset)
    send(args.device_address, args.char_uuid, packet)
