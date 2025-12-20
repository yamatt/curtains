from enum import Enum, auto
from random import choice, randint


class SnowflakeState(Enum):
    FALLING = auto()
    ROLLING = auto()
    LANDED = auto()


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
        return any([self.column_height(x) >= self.height for x in range(self.width)])

    def clear(self):
        """Clear all snowflakes from the grid"""
        self.snowflakes.clear()

    def add_snowflake(self):
        self.snowflakes.append(Snowflake.from_grid(self))

    def next(self):
        for snowflake in self.snowflakes:
            new_y = snowflake.y - 1
            if snowflake.state == SnowflakeState.FALLING:
                if new_y <= 0 or self.column_height(snowflake.x) <= new_y:
                    snowflake.state = SnowflakeState.ROLLING
                else:
                    snowflake = snowflake.y = new_y

            elif snowflake.state == SnowflakeState.ROLLING:
                if (
                    self.column_height(snowflake.x - 1) < new_y
                    and self.column_height(snowflake.x + 1) < new_y
                ):
                    direction = choice([-1, 1])
                    snowflake.x += direction
                    snowflake.y = new_y
                elif self.column_height(snowflake.x - 1) < new_y:
                    snowflake.x -= 1
                    snowflake.y = new_y
                elif self.column_height(snowflake.x + 1) < new_y:
                    snowflake.x += 1
                    snowflake.y = new_y
                else:
                    snowflake.state = SnowflakeState.LANDED


class Snowflake:
    @classmethod
    def from_grid(cls, grid: SnowflakeGrid):
        return cls(
            x=randint(0, grid.width - 1),
            y=grid.height - 1,
            state=SnowflakeState.FALLING,
        )

    def __init__(self, x: int, y: int, state: SnowflakeState = SnowflakeState.FALLING):
        self.x = x
        self.y = y
        self.state = state
