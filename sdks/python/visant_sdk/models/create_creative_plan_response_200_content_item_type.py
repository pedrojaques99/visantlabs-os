from enum import Enum


class CreateCreativePlanResponse200ContentItemType(str, Enum):
    TEXT = "text"

    def __str__(self) -> str:
        return str(self.value)
