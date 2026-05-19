from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.post_mockups_batch_generate_body_aspect_ratio import PostMockupsBatchGenerateBodyAspectRatio
from ..models.post_mockups_batch_generate_body_provider import PostMockupsBatchGenerateBodyProvider
from ..models.post_mockups_batch_generate_body_resolution import PostMockupsBatchGenerateBodyResolution
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_mockups_batch_generate_body_base_image import PostMockupsBatchGenerateBodyBaseImage


T = TypeVar("T", bound="PostMockupsBatchGenerateBody")


@_attrs_define
class PostMockupsBatchGenerateBody:
    """
    Attributes:
        prompts (list[str]): Array of prompts (max 20)
        provider (PostMockupsBatchGenerateBodyProvider | Unset):  Default: PostMockupsBatchGenerateBodyProvider.OPENAI.
        model (str | Unset):  Default: 'gpt-image-2'.
        aspect_ratio (PostMockupsBatchGenerateBodyAspectRatio | Unset):  Default:
            PostMockupsBatchGenerateBodyAspectRatio.VALUE_0.
        resolution (PostMockupsBatchGenerateBodyResolution | Unset):  Default:
            PostMockupsBatchGenerateBodyResolution.VALUE_0.
        brand_guideline_id (str | Unset):
        base_image (PostMockupsBatchGenerateBodyBaseImage | Unset):
    """

    prompts: list[str]
    provider: PostMockupsBatchGenerateBodyProvider | Unset = PostMockupsBatchGenerateBodyProvider.OPENAI
    model: str | Unset = "gpt-image-2"
    aspect_ratio: PostMockupsBatchGenerateBodyAspectRatio | Unset = PostMockupsBatchGenerateBodyAspectRatio.VALUE_0
    resolution: PostMockupsBatchGenerateBodyResolution | Unset = PostMockupsBatchGenerateBodyResolution.VALUE_0
    brand_guideline_id: str | Unset = UNSET
    base_image: PostMockupsBatchGenerateBodyBaseImage | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        prompts = self.prompts

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

        base_image: dict[str, Any] | Unset = UNSET
        if not isinstance(self.base_image, Unset):
            base_image = self.base_image.to_dict()

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
        if base_image is not UNSET:
            field_dict["baseImage"] = base_image

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_mockups_batch_generate_body_base_image import PostMockupsBatchGenerateBodyBaseImage

        d = dict(src_dict)
        prompts = cast(list[str], d.pop("prompts"))

        _provider = d.pop("provider", UNSET)
        provider: PostMockupsBatchGenerateBodyProvider | Unset
        if isinstance(_provider, Unset):
            provider = UNSET
        else:
            provider = PostMockupsBatchGenerateBodyProvider(_provider)

        model = d.pop("model", UNSET)

        _aspect_ratio = d.pop("aspectRatio", UNSET)
        aspect_ratio: PostMockupsBatchGenerateBodyAspectRatio | Unset
        if isinstance(_aspect_ratio, Unset):
            aspect_ratio = UNSET
        else:
            aspect_ratio = PostMockupsBatchGenerateBodyAspectRatio(_aspect_ratio)

        _resolution = d.pop("resolution", UNSET)
        resolution: PostMockupsBatchGenerateBodyResolution | Unset
        if isinstance(_resolution, Unset):
            resolution = UNSET
        else:
            resolution = PostMockupsBatchGenerateBodyResolution(_resolution)

        brand_guideline_id = d.pop("brandGuidelineId", UNSET)

        _base_image = d.pop("baseImage", UNSET)
        base_image: PostMockupsBatchGenerateBodyBaseImage | Unset
        if isinstance(_base_image, Unset):
            base_image = UNSET
        else:
            base_image = PostMockupsBatchGenerateBodyBaseImage.from_dict(_base_image)

        post_mockups_batch_generate_body = cls(
            prompts=prompts,
            provider=provider,
            model=model,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            brand_guideline_id=brand_guideline_id,
            base_image=base_image,
        )

        post_mockups_batch_generate_body.additional_properties = d
        return post_mockups_batch_generate_body

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
