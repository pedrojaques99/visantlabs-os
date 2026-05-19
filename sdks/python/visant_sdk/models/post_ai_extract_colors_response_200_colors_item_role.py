from enum import Enum


class PostAiExtractColorsResponse200ColorsItemRole(str, Enum):
    ACCENT = "accent"
    BACKGROUND = "background"
    NEUTRAL = "neutral"
    PRIMARY = "primary"
    SECONDARY = "secondary"

    def __str__(self) -> str:
        return str(self.value)
