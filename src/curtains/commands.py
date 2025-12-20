from itertools import batched

from PIL import Image

from .packet import Packet, TypedPacket
from .messages import (
    FullColor,
    On,
    Off,
    PixelUpdate,
    PixelClear,
    PixelFillOffset,
    PixelFillColor,
    PixelFillRandomColor,
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
        packet = PixelFillColor(color, offset)
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
        "red": PixelFillColor.Color.RED,
        "orange": PixelFillColor.Color.ORANGE,
        "yellow": PixelFillColor.Color.YELLOW,
        "green": PixelFillColor.Color.GREEN,
        "blue": PixelFillColor.Color.BLUE,
        "purple": PixelFillColor.Color.PURPLE,
        "white": PixelFillColor.Color.WHITE,
        "off": PixelFillColor.Color.OFF,
    }
    # If the user requested random fill, delegate to random_fill
    if getattr(args, "color", None) == "random":
        return random_fill(args)

    color = color_map[args.color]
    offset = getattr(args, "offset", 0)

    packet = PixelFillColor(color, offset)
    send(args.device_address, args.char_uuid, packet)


def random_fill(args):
    """Fill pixels from an offset with random colors."""
    offset = getattr(args, "offset", 0)
    packet = PixelFillRandomColor(offset)
    send(args.device_address, args.char_uuid, packet)


def image(args):
    """Send an image to the curtains."""

    image = Image.open(args.image_path).convert("HSV")

    # check image size
    if image.size != (20, 20):
        raise ValueError("Image must be 20x20 pixels")

    pixel_color = []

    for x in range(image.size[0]):
        for y in range(image.size[1]):
            hue, saturation, value = image.getpixel((x, y))  # hue, saturation, value
            if value < 50:
                color = PixelUpdate.Color.OFF.value
            elif value >= 200 and saturation < 50:  # high value, low saturation = white
                color = PixelUpdate.Color.WHITE.value
            else:
                # Map hue (0-255 in PIL's HSV) to byte (0-180)
                color = int((hue / 255) * 180).to_bytes(1, "big")
            pixel_color.append(color)

    offset = 0
    for pixel_batch in batched(pixel_color, PixelFillOffset.MAX_PIXELS):
        packet = PixelFillOffset(pixel_batch, offset=offset)
        send(args.device_address, args.char_uuid, packet)
        offset += PixelFillOffset.MAX_PIXELS
