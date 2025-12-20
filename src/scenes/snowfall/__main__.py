import click
from random import randint

from .grid import SnowflakeGrid, Snowflake, SnowflakeState
from .ble import Controller, SnowfallUpdatePacket

WIDTH = 20
HEIGHT = 20

NEW_SNOWFLAKE_CHANCE = 0.1


@click.command()
@click.option("mac_address", required=True, help="MAC address of the device")
def main(mac_address):
    ble = Controller(mac_address, "49535343-8841-43f4-a8d4-ecbe34729bb3")
    ble.start()

    grid = SnowflakeGrid(rows=HEIGHT, cols=WIDTH)

    grid.add_snowflake()

    prev_frame = grid.snowflakes.copy()

    while True:
        # Check if display is full and clear if needed
        if grid.is_full():
            ble.clear()
            grid.clear()
            grid.add_snowflake()
            prev_frame = grid.snowflakes.copy()
            continue

        # Possibly add a new snowflake
        if randint(0, 100) < NEW_SNOWFLAKE_CHANCE * 100:
            grid.add_snowflake()
        grid.next()
        new_frame = grid.snowflakes.copy()

        # Convert frames to sets of (x, y) positions for easy comparison
        prev_positions = {(s.x, s.y) for s in prev_frame}
        new_positions = {(s.x, s.y) for s in new_frame}

        # Find LEDs to turn off (were in prev but not in new)
        leds_to_turn_off = prev_positions - new_positions

        # Find LEDs to turn on (are in new but not in prev)
        leds_to_turn_on = new_positions - prev_positions

        # Update the LEDs that changed
        updates = []

        # Turn off LEDs that no longer have snowflakes
        for x, y in leds_to_turn_off:
            # Calculate index (column-major order: x * 20 + y)
            index = x * HEIGHT + y
            updates.append(SnowfallUpdatePacket.OFF + index.to_bytes(2, "big"))

        # Turn on LEDs that now have snowflakes
        for x, y in leds_to_turn_on:
            # Calculate index (column-major order: x * 20 + y)
            index = x * HEIGHT + y
            updates.append(SnowfallUpdatePacket.WHITE + index.to_bytes(2, "big"))

        # Send the update packet if there are changes
        if updates:
            packet = SnowfallUpdatePacket(updates)
            ble.write(packet)

        # Update prev_frame for next iteration
        prev_frame = new_frame
