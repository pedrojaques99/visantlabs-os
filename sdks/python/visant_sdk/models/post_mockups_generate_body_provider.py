from enum import Enum


class PostMockupsGenerateBodyProvider(str, Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    SEEDREAM = "seedream"

    def __str__(self) -> str:
        return str(self.value)
