from enum import Enum


class PostMockupsBatchGenerateBodyProvider(str, Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    SEEDREAM = "seedream"

    def __str__(self) -> str:
        return str(self.value)
