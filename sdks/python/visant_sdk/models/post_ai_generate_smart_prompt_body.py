from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.post_ai_generate_smart_prompt_body_aspect_ratio import PostAiGenerateSmartPromptBodyAspectRatio
from ..types import UNSET, Unset

T = TypeVar("T", bound="PostAiGenerateSmartPromptBody")


@_attrs_define
class PostAiGenerateSmartPromptBody:
    """
    Attributes:
        design_type (str): Type of design (e.g. product mockup, social media post)
        additional_prompt (str | Unset):
        aspect_ratio (PostAiGenerateSmartPromptBodyAspectRatio | Unset):
        branding_tags (list[str] | Unset):
        brand_guideline_id (str | Unset):
        negative_prompt (str | Unset):
    """

    design_type: str
    additional_prompt: str | Unset = UNSET
    aspect_ratio: PostAiGenerateSmartPromptBodyAspectRatio | Unset = UNSET
    branding_tags: list[str] | Unset = UNSET
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
        aspect_ratio: PostAiGenerateSmartPromptBodyAspectRatio | Unset
        if isinstance(_aspect_ratio, Unset):
            aspect_ratio = UNSET
        else:
            aspect_ratio = PostAiGenerateSmartPromptBodyAspectRatio(_aspect_ratio)

        branding_tags = cast(list[str], d.pop("brandingTags", UNSET))

        brand_guideline_id = d.pop("brandGuidelineId", UNSET)

        negative_prompt = d.pop("negativePrompt", UNSET)

        post_ai_generate_smart_prompt_body = cls(
            design_type=design_type,
            additional_prompt=additional_prompt,
            aspect_ratio=aspect_ratio,
            branding_tags=branding_tags,
            brand_guideline_id=brand_guideline_id,
            negative_prompt=negative_prompt,
        )

        post_ai_generate_smart_prompt_body.additional_properties = d
        return post_ai_generate_smart_prompt_body

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
