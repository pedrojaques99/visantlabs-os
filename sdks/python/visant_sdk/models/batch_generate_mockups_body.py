from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.batch_generate_mockups_body_aspect_ratio import BatchGenerateMockupsBodyAspectRatio
from ..models.batch_generate_mockups_body_provider import BatchGenerateMockupsBodyProvider
from ..models.batch_generate_mockups_body_resolution import BatchGenerateMockupsBodyResolution
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.batch_generate_mockups_body_prompts_item_type_1 import BatchGenerateMockupsBodyPromptsItemType1


T = TypeVar("T", bound="BatchGenerateMockupsBody")


@_attrs_define
class BatchGenerateMockupsBody:
    """
    Attributes:
        prompts (list[BatchGenerateMockupsBodyPromptsItemType1 | str]): Array of prompts (string) or prompt objects with
            per-item referenceImages (max 20)
        provider (BatchGenerateMockupsBodyProvider | Unset): Image generation provider. Default: openai Default:
            BatchGenerateMockupsBodyProvider.OPENAI.
        model (str | Unset): Model name. For openai: gpt-image-1 or gpt-image-2. For gemini: gemini-2.0-flash-exp-image-
            generation. Default: 'gpt-image-2'.
        aspect_ratio (BatchGenerateMockupsBodyAspectRatio | Unset): Aspect ratio for all images. Default: 1:1 Default:
            BatchGenerateMockupsBodyAspectRatio.VALUE_0.
        resolution (BatchGenerateMockupsBodyResolution | Unset): Output resolution for all images. Default: 1K Default:
            BatchGenerateMockupsBodyResolution.VALUE_0.
        brand_guideline_id (str | Unset): Brand guideline id to inject brand context into all prompts automatically
        base_image_url (str | Unset): Optional base image URL applied to all generations (image-to-image)
    """

    prompts: list[BatchGenerateMockupsBodyPromptsItemType1 | str]
    provider: BatchGenerateMockupsBodyProvider | Unset = BatchGenerateMockupsBodyProvider.OPENAI
    model: str | Unset = "gpt-image-2"
    aspect_ratio: BatchGenerateMockupsBodyAspectRatio | Unset = BatchGenerateMockupsBodyAspectRatio.VALUE_0
    resolution: BatchGenerateMockupsBodyResolution | Unset = BatchGenerateMockupsBodyResolution.VALUE_0
    brand_guideline_id: str | Unset = UNSET
    base_image_url: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.batch_generate_mockups_body_prompts_item_type_1 import BatchGenerateMockupsBodyPromptsItemType1

        prompts = []
        for prompts_item_data in self.prompts:
            prompts_item: dict[str, Any] | str
            if isinstance(prompts_item_data, BatchGenerateMockupsBodyPromptsItemType1):
                prompts_item = prompts_item_data.to_dict()
            else:
                prompts_item = prompts_item_data
            prompts.append(prompts_item)

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

        brand_guideline_id = self.brand_guideline_id

        base_image_url = self.base_image_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "prompts": prompts,
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
        if brand_guideline_id is not UNSET:
            field_dict["brandGuidelineId"] = brand_guideline_id
        if base_image_url is not UNSET:
            field_dict["baseImageUrl"] = base_image_url

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.batch_generate_mockups_body_prompts_item_type_1 import BatchGenerateMockupsBodyPromptsItemType1

        d = dict(src_dict)
        prompts = []
        _prompts = d.pop("prompts")
        for prompts_item_data in _prompts:

            def _parse_prompts_item(data: object) -> BatchGenerateMockupsBodyPromptsItemType1 | str:
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    prompts_item_type_1 = BatchGenerateMockupsBodyPromptsItemType1.from_dict(data)

                    return prompts_item_type_1
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                return cast(BatchGenerateMockupsBodyPromptsItemType1 | str, data)

            prompts_item = _parse_prompts_item(prompts_item_data)

            prompts.append(prompts_item)

        _provider = d.pop("provider", UNSET)
        provider: BatchGenerateMockupsBodyProvider | Unset
        if isinstance(_provider, Unset):
            provider = UNSET
        else:
            provider = BatchGenerateMockupsBodyProvider(_provider)

        model = d.pop("model", UNSET)

        _aspect_ratio = d.pop("aspectRatio", UNSET)
        aspect_ratio: BatchGenerateMockupsBodyAspectRatio | Unset
        if isinstance(_aspect_ratio, Unset):
            aspect_ratio = UNSET
        else:
            aspect_ratio = BatchGenerateMockupsBodyAspectRatio(_aspect_ratio)

        _resolution = d.pop("resolution", UNSET)
        resolution: BatchGenerateMockupsBodyResolution | Unset
        if isinstance(_resolution, Unset):
            resolution = UNSET
        else:
            resolution = BatchGenerateMockupsBodyResolution(_resolution)

        brand_guideline_id = d.pop("brandGuidelineId", UNSET)

        base_image_url = d.pop("baseImageUrl", UNSET)

        batch_generate_mockups_body = cls(
            prompts=prompts,
            provider=provider,
            model=model,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            brand_guideline_id=brand_guideline_id,
            base_image_url=base_image_url,
        )

        batch_generate_mockups_body.additional_properties = d
        return batch_generate_mockups_body

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
