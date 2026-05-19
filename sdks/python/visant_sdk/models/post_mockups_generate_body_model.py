from enum import Enum


class PostMockupsGenerateBodyModel(str, Enum):
    GEMINI_2_5_FLASH_IMAGE = "gemini-2.5-flash-image"
    GEMINI_3_1_FLASH_IMAGE_PREVIEW = "gemini-3.1-flash-image-preview"
    GEMINI_3_PRO_IMAGE_PREVIEW = "gemini-3-pro-image-preview"
    GPT_IMAGE_2 = "gpt-image-2"
    SEEDREAM_4_0 = "seedream-4.0"
    SEEDREAM_4_5 = "seedream-4.5"

    def __str__(self) -> str:
        return str(self.value)
