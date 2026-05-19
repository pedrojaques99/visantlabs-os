from enum import Enum


class GenerateMockupBodyProvider(str, Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    SEEDREAM = "seedream"

    def __str__(self) -> str:
        return str(self.value)
