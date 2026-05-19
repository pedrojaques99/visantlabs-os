from enum import Enum


class UpdateCanvasProjectResponse200ContentItemType(str, Enum):
    TEXT = "text"

    def __str__(self) -> str:
        return str(self.value)
