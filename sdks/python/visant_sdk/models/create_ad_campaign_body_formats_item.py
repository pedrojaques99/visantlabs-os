from enum import Enum


class CreateAdCampaignBodyFormatsItem(str, Enum):
    BANNER = "banner"
    PORTRAIT = "portrait"
    SQUARE = "square"
    STORY = "story"

    def __str__(self) -> str:
        return str(self.value)
