from enum import Enum


class CreateAdCampaignBodyModel(str, Enum):
    GEMINI = "gemini"
    GPT_IMAGE_1 = "gpt-image-1"
    GPT_IMAGE_2 = "gpt-image-2"

    def __str__(self) -> str:
        return str(self.value)
