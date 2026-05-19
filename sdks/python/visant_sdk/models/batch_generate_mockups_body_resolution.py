from enum import Enum


class BatchGenerateMockupsBodyResolution(str, Enum):
    VALUE_0 = "1K"
    VALUE_1 = "2K"
    VALUE_2 = "4K"

    def __str__(self) -> str:
        return str(self.value)
