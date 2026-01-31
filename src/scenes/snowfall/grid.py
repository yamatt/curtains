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

    def column_height(self, column) -> int:
        return max(
            [
                snowflake.y
                for snowflake in self.snowflakes
                if snowflake.x == column and snowflake.state == SnowflakeState.LANDED
            ],
            default=0,
        )

    def is_full(self):
        """Check if the display is full (any column has reached the top)"""
        return any(
            [self.column_height(x) >= self.height - 1 for x in range(self.width)]
        )

    def clear(self):
        """Clear all snowflakes from the grid"""
        self.snowflakes.clear()

    def add_snowflake(self):
        print("Adding snowflake")
        self.snowflakes.append(Snowflake.from_grid(self))

    def next(self):
        for snowflake in self.snowflakes:
            if snowflake.state == SnowflakeState.FALLING:
                new_y = snowflake.y - 1
                # Check if it hit the ground
                if new_y < 0:
                    snowflake.y = 0
                    snowflake.state = SnowflakeState.LANDED
                # Check if it hit another snowflake
                elif self.column_height(snowflake.x) >= new_y:
                    snowflake.state = SnowflakeState.ROLLING
                else:
                    snowflake.y = new_y

            elif snowflake.state == SnowflakeState.ROLLING:
                new_y = snowflake.y - 1
                # Can't roll below ground
                if new_y < 0:
                    snowflake.state = SnowflakeState.LANDED
                    continue

                left_height = (
                    self.column_height(snowflake.x - 1)
                    if snowflake.x > 0
                    else self.height
                )
                right_height = (
                    self.column_height(snowflake.x + 1)
                    if snowflake.x < self.width - 1
                    else self.height
                )

                # Can roll both ways
                if left_height < new_y and right_height < new_y:
                    direction = choice([-1, 1])
                    snowflake.x += direction
                    snowflake.y = new_y
                # Can only roll left
                elif left_height < new_y:
                    snowflake.x -= 1
                    snowflake.y = new_y
                # Can only roll right
                elif right_height < new_y:
                    snowflake.x += 1
                    snowflake.y = new_y
                # Can't roll anywhere, land here
                else:
                    snowflake.state = SnowflakeState.LANDED


class Snowflake:
    @classmethod
    def from_grid(cls, grid: SnowflakeGrid):
        return cls(
            x=randint(0, grid.width - 1),
            y=grid.height - 1,
            grid=grid,
            state=SnowflakeState.FALLING,
        )

    def __init__(
        self,
        x: int,
        y: int,
        grid: SnowflakeGrid,
        state: SnowflakeState = SnowflakeState.FALLING,
    ):
        self.x = x
        self.y = y
        self.grid = grid
        self.state = state

    @property
    def index(self) -> int:
        return self.x * self.grid.height + self.y
