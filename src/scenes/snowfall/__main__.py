import asyncio
import click
from random import random
from time import sleep

from .grid import SnowflakeGrid, Snowflake, SnowflakeState
from .ble import Controller, SnowfallUpdatePacket

WIDTH = 20
HEIGHT = 20

NEW_SNOWFLAKE_CHANCE = 0.1
FRAME_DELAY = 0.1  # seconds between frames


async def run_snowfall(mac_address, height):
    ble = Controller(mac_address, "49535343-8841-43f4-a8d4-ecbe34729bb3")
    await ble.start()

    try:

        grid = SnowflakeGrid(height=height, width=WIDTH)

        grid.add_snowflake()

        prev_frame = grid.snowflakes.copy()

        print("Starting snowfall animation...")

        while True:
            # Check if display is full and clear if needed
            if grid.is_full():
                print("Clearing grid")
                await ble.clear()
                grid.clear()
                grid.add_snowflake()
                prev_frame = grid.snowflakes.copy()
                continue

            # Possibly add a new snowflake
            if random() < NEW_SNOWFLAKE_CHANCE:
                print("Random snowflake added")
                grid.add_snowflake()

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
                updates.append(
                    SnowfallUpdatePacket.OFF.value + index.to_bytes(2, "big")
                )

            # Turn on LEDs that now have snowflakes
            for x, y in leds_to_turn_on:
                # Calculate index (column-major order: x * 20 + y)
                index = x * HEIGHT + y
                updates.append(
                    SnowfallUpdatePacket.WHITE.value + index.to_bytes(2, "big")
                )

            # Send the update packet if there are changes
            if updates:
                packet = SnowfallUpdatePacket(updates)
                await ble.write(packet)

            # Update prev_frame for next iteration
            prev_frame = new_frame

            grid.next()

            # Delay between frames
            await asyncio.sleep(FRAME_DELAY)
    finally:
        await ble.disconnect()


@click.command()
@click.argument("mac_address", required=True)
@click.option("--height", default=HEIGHT, help="Height of the snowfall grid")
def main(mac_address, height):
    asyncio.run(run_snowfall(mac_address, height=height))
