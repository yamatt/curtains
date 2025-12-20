from enum import Enum, auto
from typing import NamedTuple
from random import choice


class SnowflakeState(Enum):
    FALLING = auto()
    ROLLING = auto()
    LANDED = auto()


class Snowflake(NamedTuple):
    x: int
    y: int
    state: SnowflakeState


class SnowflakeGrid:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.snowflakes = []

    @property
    def grid(self):
        grid = [[None for _ in range(self.width)] for _ in range(self.height)]
        for snowflake in self.snowflakes:
            grid[snowflake.y][snowflake.x] = snowflake

    def column_height(self, x):
        return (
            max(
                (snowflake.y for snowflake in self.snowflakes if snowflake.x == x),
                default=-1,
            )
            + 1
        )

    def is_full(self):
        """Check if the display is full (any column has reached the top)"""
        for x in range(self.width):
            if self.column_height(x) >= self.height:
                return True
        return False

    def clear(self):
        """Clear all snowflakes from the grid"""
        self.snowflakes.clear()

    def add_snowflake(self):
        snowflake = Snowflake(
            x=choice(range(self.width)),
            y=self.height - 1,
            state=SnowflakeState.FALLING,
        )
        self.snowflakes.append(snowflake)

    def next(self):
        for snowflake in self.snowflakes:
            if snowflake.state == SnowflakeState.FALLING:
                snowflake.y -= 1
                if (
                    snowflake.y == 0
                    or snowflake.y == self.column_height(snowflake.x) - 1
                ):
                    snowflake.state = SnowflakeState.ROLLING
            elif snowflake.state == SnowflakeState.ROLLING:
                if (
                    self.column_height(snowflake.x - 1) < snowflake.y
                    and self.column_height(snowflake.x + 1) < snowflake.y
                ):
                    direction = choice([-1, 1])
                    snowflake.x += direction
                    snowflake.y += 1
                elif self.column_height(snowflake.x - 1) < snowflake.y:
                    snowflake.x -= 1
                    snowflake.y += 1
                elif self.column_height(snowflake.x + 1) < snowflake.y:
                    snowflake.x += 1
                    snowflake.y += 1
                else:
                    snowflake.state = SnowflakeState.LANDED
