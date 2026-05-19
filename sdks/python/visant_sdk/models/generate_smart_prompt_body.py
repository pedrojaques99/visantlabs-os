from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.generate_smart_prompt_body_aspect_ratio import GenerateSmartPromptBodyAspectRatio
from ..types import UNSET, Unset

T = TypeVar("T", bound="GenerateSmartPromptBody")


@_attrs_define
class GenerateSmartPromptBody:
    """
    Attributes:
        design_type (str): Type of design (e.g. product mockup, social media post, banner)
        additional_prompt (str | Unset): Free-text creative direction to include
        aspect_ratio (GenerateSmartPromptBodyAspectRatio | Unset):  Default: GenerateSmartPromptBodyAspectRatio.VALUE_0.
        branding_tags (list[str] | Unset): Brand style tags
        category_tags (list[str] | Unset):
        location_tags (list[str] | Unset):
        angle_tags (list[str] | Unset):
        lighting_tags (list[str] | Unset):
        effect_tags (list[str] | Unset):
        material_tags (list[str] | Unset):
        base_image_url (str | Unset): URL of a reference image
        brand_guideline_id (str | Unset): Brand guideline id for brand-aware prompt
        negative_prompt (str | Unset): Things to exclude from the image
    """

    design_type: str
    additional_prompt: str | Unset = UNSET
    aspect_ratio: GenerateSmartPromptBodyAspectRatio | Unset = GenerateSmartPromptBodyAspectRatio.VALUE_0
    branding_tags: list[str] | Unset = UNSET
    category_tags: list[str] | Unset = UNSET
    location_tags: list[str] | Unset = UNSET
    angle_tags: list[str] | Unset = UNSET
    lighting_tags: list[str] | Unset = UNSET
    effect_tags: list[str] | Unset = UNSET
    material_tags: list[str] | Unset = UNSET
    base_image_url: str | Unset = UNSET
    brand_guideline_id: str | Unset = UNSET
    negative_prompt: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        design_type = self.design_type

        additional_prompt = self.additional_prompt

        aspect_ratio: str | Unset = UNSET
        if not isinstance(self.aspect_ratio, Unset):
            aspect_ratio = self.aspect_ratio.value

        branding_tags: list[str] | Unset = UNSET
        if not isinstance(self.branding_tags, Unset):
            branding_tags = self.branding_tags

        category_tags: list[str] | Unset = UNSET
        if not isinstance(self.category_tags, Unset):
            category_tags = self.category_tags

        location_tags: list[str] | Unset = UNSET
        if not isinstance(self.location_tags, Unset):
            location_tags = self.location_tags

        angle_tags: list[str] | Unset = UNSET
        if not isinstance(self.angle_tags, Unset):
            angle_tags = self.angle_tags

        lighting_tags: list[str] | Unset = UNSET
        if not isinstance(self.lighting_tags, Unset):
            lighting_tags = self.lighting_tags

        effect_tags: list[str] | Unset = UNSET
        if not isinstance(self.effect_tags, Unset):
            effect_tags = self.effect_tags

        material_tags: list[str] | Unset = UNSET
        if not isinstance(self.material_tags, Unset):
            material_tags = self.material_tags

        base_image_url = self.base_image_url

        brand_guideline_id = self.brand_guideline_id

        negative_prompt = self.negative_prompt

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "designType": design_type,
            }
        )
        if additional_prompt is not UNSET:
            field_dict["additionalPrompt"] = additional_prompt
        if aspect_ratio is not UNSET:
            field_dict["aspectRatio"] = aspect_ratio
        if branding_tags is not UNSET:
            field_dict["brandingTags"] = branding_tags
        if category_tags is not UNSET:
            field_dict["categoryTags"] = category_tags
        if location_tags is not UNSET:
            field_dict["locationTags"] = location_tags
        if angle_tags is not UNSET:
            field_dict["angleTags"] = angle_tags
        if lighting_tags is not UNSET:
            field_dict["lightingTags"] = lighting_tags
        if effect_tags is not UNSET:
            field_dict["effectTags"] = effect_tags
        if material_tags is not UNSET:
            field_dict["materialTags"] = material_tags
        if base_image_url is not UNSET:
            field_dict["baseImageUrl"] = base_image_url
        if brand_guideline_id is not UNSET:
            field_dict["brandGuidelineId"] = brand_guideline_id
        if negative_prompt is not UNSET:
            field_dict["negativePrompt"] = negative_prompt

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        design_type = d.pop("designType")

        additional_prompt = d.pop("additionalPrompt", UNSET)

        _aspect_ratio = d.pop("aspectRatio", UNSET)
        aspect_ratio: GenerateSmartPromptBodyAspectRatio | Unset
        if isinstance(_aspect_ratio, Unset):
            aspect_ratio = UNSET
        else:
            aspect_ratio = GenerateSmartPromptBodyAspectRatio(_aspect_ratio)

        branding_tags = cast(list[str], d.pop("brandingTags", UNSET))

        category_tags = cast(list[str], d.pop("categoryTags", UNSET))

        location_tags = cast(list[str], d.pop("locationTags", UNSET))

        angle_tags = cast(list[str], d.pop("angleTags", UNSET))

        lighting_tags = cast(list[str], d.pop("lightingTags", UNSET))

        effect_tags = cast(list[str], d.pop("effectTags", UNSET))

        material_tags = cast(list[str], d.pop("materialTags", UNSET))

        base_image_url = d.pop("baseImageUrl", UNSET)

        brand_guideline_id = d.pop("brandGuidelineId", UNSET)

        negative_prompt = d.pop("negativePrompt", UNSET)

        generate_smart_prompt_body = cls(
            design_type=design_type,
            additional_prompt=additional_prompt,
            aspect_ratio=aspect_ratio,
            branding_tags=branding_tags,
            category_tags=category_tags,
            location_tags=location_tags,
            angle_tags=angle_tags,
            lighting_tags=lighting_tags,
            effect_tags=effect_tags,
            material_tags=material_tags,
            base_image_url=base_image_url,
            brand_guideline_id=brand_guideline_id,
            negative_prompt=negative_prompt,
        )

        generate_smart_prompt_body.additional_properties = d
        return generate_smart_prompt_body

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
