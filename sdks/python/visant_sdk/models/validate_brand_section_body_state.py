from enum import Enum


class ValidateBrandSectionBodyState(str, Enum):
    APPROVED = "approved"
    NEEDS_WORK = "needs_work"
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)
