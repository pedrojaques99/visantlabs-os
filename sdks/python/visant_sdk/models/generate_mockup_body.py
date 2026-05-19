from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.generate_mockup_body_aspect_ratio import GenerateMockupBodyAspectRatio
from ..models.generate_mockup_body_provider import GenerateMockupBodyProvider
from ..models.generate_mockup_body_resolution import GenerateMockupBodyResolution
from ..types import UNSET, Unset

T = TypeVar("T", bound="GenerateMockupBody")


@_attrs_define
class GenerateMockupBody:
    """
    Attributes:
        prompt_text (str): Prompt describing the image to generate
        provider (GenerateMockupBodyProvider | Unset): Image generation provider. Default: openai Default:
            GenerateMockupBodyProvider.OPENAI.
        model (str | Unset): Model name. For openai: gpt-image-1 or gpt-image-2. For gemini: gemini-2.0-flash-exp-image-
            generation. For seedream: seedream-3-0. Default: 'gpt-image-2'.
        aspect_ratio (GenerateMockupBodyAspectRatio | Unset): Aspect ratio. Default: 1:1 Default:
            GenerateMockupBodyAspectRatio.VALUE_0.
        resolution (GenerateMockupBodyResolution | Unset): Output resolution. Default: 1K Default:
            GenerateMockupBodyResolution.VALUE_0.
        base_image_url (str | Unset): URL of a base image for image-to-image generation
        brand_guideline_id (str | Unset): Brand guideline id to inject brand context into the prompt automatically
    """

    prompt_text: str
    provider: GenerateMockupBodyProvider | Unset = GenerateMockupBodyProvider.OPENAI
    model: str | Unset = "gpt-image-2"
    aspect_ratio: GenerateMockupBodyAspectRatio | Unset = GenerateMockupBodyAspectRatio.VALUE_0
    resolution: GenerateMockupBodyResolution | Unset = GenerateMockupBodyResolution.VALUE_0
    base_image_url: str | Unset = UNSET
    brand_guideline_id: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        prompt_text = self.prompt_text

        provider: str | Unset = UNSET
        if not isinstance(self.provider, Unset):
            provider = self.provider.value

        model = self.model

        aspect_ratio: str | Unset = UNSET
        if not isinstance(self.aspect_ratio, Unset):
            aspect_ratio = self.aspect_ratio.value

        resolution: str | Unset = UNSET
        if not isinstance(self.resolution, Unset):
            resolution = self.resolution.value

        base_image_url = self.base_image_url

        brand_guideline_id = self.brand_guideline_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "promptText": prompt_text,
            }
        )
        if provider is not UNSET:
            field_dict["provider"] = provider
        if model is not UNSET:
            field_dict["model"] = model
        if aspect_ratio is not UNSET:
            field_dict["aspectRatio"] = aspect_ratio
        if resolution is not UNSET:
            field_dict["resolution"] = resolution
        if base_image_url is not UNSET:
            field_dict["baseImageUrl"] = base_image_url
        if brand_guideline_id is not UNSET:
            field_dict["brandGuidelineId"] = brand_guideline_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        prompt_text = d.pop("promptText")

        _provider = d.pop("provider", UNSET)
        provider: GenerateMockupBodyProvider | Unset
        if isinstance(_provider, Unset):
            provider = UNSET
        else:
            provider = GenerateMockupBodyProvider(_provider)

        model = d.pop("model", UNSET)

        _aspect_ratio = d.pop("aspectRatio", UNSET)
        aspect_ratio: GenerateMockupBodyAspectRatio | Unset
        if isinstance(_aspect_ratio, Unset):
            aspect_ratio = UNSET
        else:
            aspect_ratio = GenerateMockupBodyAspectRatio(_aspect_ratio)

        _resolution = d.pop("resolution", UNSET)
        resolution: GenerateMockupBodyResolution | Unset
        if isinstance(_resolution, Unset):
            resolution = UNSET
        else:
            resolution = GenerateMockupBodyResolution(_resolution)

        base_image_url = d.pop("baseImageUrl", UNSET)

        brand_guideline_id = d.pop("brandGuidelineId", UNSET)

        generate_mockup_body = cls(
            prompt_text=prompt_text,
            provider=provider,
            model=model,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            base_image_url=base_image_url,
            brand_guideline_id=brand_guideline_id,
        )

        generate_mockup_body.additional_properties = d
        return generate_mockup_body

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
