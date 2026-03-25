from enum import Enum
from random import choice

from .packet import TypedPacket, PowerPacketBase, PixelCommandBase


class On(PowerPacketBase):
    def __init__(self):
        super().__init__(b"\x01")


class Off(PowerPacketBase):
    def __init__(self):
        super().__init__(b"\x00")


class Pause(PowerPacketBase):
    def __init__(self):
        super().__init__(b"\x02\x00")


class Preset(TypedPacket):
    PACKET_TYPE = TypedPacket.Types.PRESET
    PRESET_ANIMATION_MODE = b"\x02"

    @classmethod
    def from_args(cls, args):
        speed = getattr(args, "speed", 10)  # Default speed if not provided
        return cls(args.preset, args.brightness, speed)

    def __init__(self, preset_id: int, brightness: int, speed: int = 10):
        # Speed parameter appears to be a 4th byte based on NOTES.md examples
        # Default speed of 10 (0x0a) for backward compatibility

        self.preset_id = preset_id
        self.brightness = brightness
        self.speed = speed

    @property
    def payload(self) -> bytes:
        return (
            self.PRESET_ANIMATION_MODE
            + self.preset_id.to_bytes(1, "big")
            + self.brightness.to_bytes(1, "big")
            + self.speed.to_bytes(1, "big")
        )


class FullColor(TypedPacket):
    PACKET_TYPE = TypedPacket.Types.PRESET
    COLOUR_MODE = b"\x01"

    @classmethod
    def from_args(cls, args):
        return cls(args.hue, args.saturation, args.brightness)

    @classmethod
    def from_rgb(cls, red: int, green: int, blue: int):
        # convert rgb to hue, saturation, brightness
        r_norm = red / 255.0
        g_norm = green / 255.0
        b_norm = blue / 255.0

        max_val = max(r_norm, g_norm, b_norm)
        min_val = min(r_norm, g_norm, b_norm)
        delta = max_val - min_val

        # Lightness
        lightness = (max_val + min_val) / 2.0

        # Saturation
        if delta == 0:
            saturation = 0.0
            hue = 0.0
        else:
            saturation = delta / (1 - abs(2 * lightness - 1))

            # Hue
            if max_val == r_norm:
                hue = ((g_norm - b_norm) / delta) % 6
            elif max_val == g_norm:
                hue = ((b_norm - r_norm) / delta) + 2
            else:
                hue = ((r_norm - g_norm) / delta) + 4

            hue *= 60

        # Convert to integer ranges
        hue_int = int(round(hue))
        saturation_int = int(round(saturation * 1000))
        lightness_int = int(round(lightness * 1000))

        return cls(hue_int, saturation_int, lightness_int)

    def __init__(self, hue: int, saturation: int, brightness: int):
        self.hue = hue
        self.saturation = saturation
        self.brightness = brightness

    @property
    def payload(self) -> bytes:
        return (
            self.COLOUR_MODE
            + self.hue.to_bytes(2, "big")
            + self.saturation.to_bytes(2, "big")
            + self.brightness.to_bytes(2, "big")
        )


class PixelClear(PixelCommandBase):
    COMMAND = b"\x00\x64\x64\x03"


class PixelDraw(PixelCommandBase):
    """
    Enter the drawing mode
    """

    COMMAND = b"\x00\x64\x64\x00"


class PixelBase(TypedPacket):
    class Color(Enum):
        """
        Red white and black/off are right.
        All the others are guesses.
        I think the hue is compressed and based on 180 degrees (0-180).
        """

        RED = b"\x00"
        ORANGE = b"\x08"
        YELLOW = b"\x20"
        GREEN = b"\x38"
        BLUE = b"\x50"
        PURPLE = b"\x88"
        WHITE = b"\xff"
        OFF = b"\xfe"


class PixelUpdate(PixelBase):
    """
    Subclass to handle the specific checksum logic and command structure
    of pixel update packets.
    """

    PACKET_TYPE = TypedPacket.Types.PIXEL_UPDATE

    def __init__(self, x: int, y: int, color: PixelBase.Color) -> "PixelUpdate":
        """
        Creates a packet to update a single pixel.

        Parameters:
            x: The coordinate x (0-19).
            y: The coordinate y (0-19).
            color: A `PixelBase.Color` enum value representing the color.
        """
        self.x = x
        self.y = y
        self.color = color

    @property
    def index(self) -> int:
        return self.y * 20 + self.x

    @property
    def payload(self) -> bytes:
        return self.index.to_bytes(2, "big") + self.color.value


class MultiPixelUpdate(PixelBase):
    """
    Pack up to 5 pixel updates into a single PIXEL_UPDATE (0xd1) packet.

    The standard BLE MTU limits a characteristic write to 20 bytes; 4 bytes of
    packet overhead (header + type + length + checksum) leave 16 bytes for
    payload, fitting at most 5 pixels at 3 bytes each.  To send more than 5
    pixels, split them across multiple packets — use ``MultiPixelUpdate.batched()``.

    Example::

        # Light up three pixels at once
        packet = MultiPixelUpdate([
            (0, 0, PixelBase.Color.RED),
            (1, 0, PixelBase.Color.GREEN),
            (2, 0, PixelBase.Color.BLUE),
        ])

        # Send a larger list automatically batched into ≤5-pixel packets
        pixels = [(x, 0, PixelBase.Color.WHITE) for x in range(10)]
        for packet in MultiPixelUpdate.batched(pixels):
            send(device_address, char_uuid, packet)
    """

    PACKET_TYPE = TypedPacket.Types.PIXEL_UPDATE
    MAX_PER_PACKET = 5  # floor((20 byte MTU - 4 byte overhead) / 3 bytes per pixel)

    @classmethod
    def batched(cls, pixels: list):
        """Yield successive MultiPixelUpdate packets of at most MAX_PER_PACKET pixels."""
        for i in range(0, len(pixels), cls.MAX_PER_PACKET):
            yield cls(pixels[i : i + cls.MAX_PER_PACKET])

    def __init__(self, pixels: list) -> "MultiPixelUpdate":
        """
        Parameters:
            pixels: List of ``(x, y, color)`` tuples, at most ``MAX_PER_PACKET`` entries.
        """
        if len(pixels) > self.MAX_PER_PACKET:
            raise ValueError(
                f"MultiPixelUpdate accepts at most {self.MAX_PER_PACKET} pixels per packet; "
                f"got {len(pixels)}. Use MultiPixelUpdate.batched() to split larger lists."
            )
        self.pixels = pixels

    @property
    def payload(self) -> bytes:
        data = b""
        for x, y, color in self.pixels:
            index = y * 20 + x
            data += index.to_bytes(2, "big") + color.value
        return data


class PixelFillBase(PixelBase):

    UNKNOWN = b"\x01\x00\x00"

    PACKET_TYPE = TypedPacket.Types.PIXEL_BULK_UPDATE

    MAX_PIXELS = 77

    def __init__(self, colors: list) -> "PixelFillBase":
        """
        Creates a packet to fill all pixels with the same colour.

        Maximum pixels in one go 78.

        Parameters:
            color: A `PixelBase.Color` enum value representing the color.
        """
        self.colors = colors

    @property
    def payload(self) -> bytes:
        return self.UNKNOWN + bytes.join(b"", self.range)


class PixelFillColors(PixelFillBase):
    """
    Make all pixels the same colour for an offset
    """

    def __init__(self, colors: list, offset: int = 0) -> "PixelFillColors":
        self.offset = offset
        self.colors = colors

    @property
    def range(self) -> range:
        return [
            (color + (i + self.offset).to_bytes(2, "big"))
            for i, color in enumerate(self.colors)
        ]


class PixelFillColor(PixelFillBase):
    """
    Make all pixels the same colour for an offset
    """

    def __init__(self, color: PixelBase.Color, offset: int = 0) -> "PixelFillColor":
        self.offset = offset
        self.color = color.value

    @property
    def range(self) -> range:
        return [
            (self.color + (i + self.offset).to_bytes(2, "big"))
            for i in range(self.MAX_PIXELS)
        ]


class PixelFillRandomColor(PixelFillColor):
    """
    Make all pixels random hue for an offset
    """

    PACKET_TYPE = TypedPacket.Types.PIXEL_BULK_UPDATE

    def __init__(self, offset: int = 0) -> "PixelFillRandomColor":
        """
        Creates a packet to fill all pixels with random hue.

        Maximum pixels in one go 78.

        Parameters:
            offset: The starting offset (0-399).
        """
        self.offset = offset

    @property
    def color(self) -> PixelBase.Color:
        return choice(list(self.Color)).value
