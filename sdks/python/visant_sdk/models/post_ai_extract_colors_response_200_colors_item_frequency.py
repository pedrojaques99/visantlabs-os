from enum import Enum


class PostAiExtractColorsResponse200ColorsItemFrequency(str, Enum):
    COMMON = "common"
    DOMINANT = "dominant"
    RARE = "rare"

    def __str__(self) -> str:
        return str(self.value)
