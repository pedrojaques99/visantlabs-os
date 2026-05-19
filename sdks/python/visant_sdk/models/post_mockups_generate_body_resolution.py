from enum import Enum


class PostMockupsGenerateBodyResolution(str, Enum):
    HD = "hd"
    VALUE_1 = "1k"
    VALUE_2 = "2k"
    VALUE_3 = "4k"

    def __str__(self) -> str:
        return str(self.value)
