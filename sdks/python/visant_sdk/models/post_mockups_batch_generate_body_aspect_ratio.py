from enum import Enum


class PostMockupsBatchGenerateBodyAspectRatio(str, Enum):
    VALUE_0 = "1:1"
    VALUE_1 = "9:16"
    VALUE_2 = "16:9"
    VALUE_3 = "4:5"

    def __str__(self) -> str:
        return str(self.value)
