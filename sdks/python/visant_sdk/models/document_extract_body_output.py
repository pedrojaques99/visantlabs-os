from enum import Enum


class DocumentExtractBodyOutput(str, Enum):
    DISK = "disk"
    INLINE = "inline"

    def __str__(self) -> str:
        return str(self.value)
