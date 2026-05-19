from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.post_mockups_generate_body_model import PostMockupsGenerateBodyModel
from ..models.post_mockups_generate_body_provider import PostMockupsGenerateBodyProvider
from ..models.post_mockups_generate_body_resolution import PostMockupsGenerateBodyResolution
from ..types import UNSET, Unset

T = TypeVar("T", bound="PostMockupsGenerateBody")


@_attrs_define
class PostMockupsGenerateBody:
    """
    Attributes:
        prompt_text (str):
        base_image (str):
        width (int | Unset):  Default: 800.
        height (int | Unset):  Default: 450.
        resolution (PostMockupsGenerateBodyResolution | Unset):
        model (PostMockupsGenerateBodyModel | Unset):
        provider (PostMockupsGenerateBodyProvider | Unset): Image generation provider. Defaults to gemini.
    """

    prompt_text: str
    base_image: str
    width: int | Unset = 800
    height: int | Unset = 450
    resolution: PostMockupsGenerateBodyResolution | Unset = UNSET
    model: PostMockupsGenerateBodyModel | Unset = UNSET
    provider: PostMockupsGenerateBodyProvider | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        prompt_text = self.prompt_text

        base_image = self.base_image

        width = self.width

        height = self.height

        resolution: str | Unset = UNSET
        if not isinstance(self.resolution, Unset):
            resolution = self.resolution.value

        model: str | Unset = UNSET
        if not isinstance(self.model, Unset):
            model = self.model.value

        provider: str | Unset = UNSET
        if not isinstance(self.provider, Unset):
            provider = self.provider.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "promptText": prompt_text,
                "baseImage": base_image,
            }
        )
        if width is not UNSET:
            field_dict["width"] = width
        if height is not UNSET:
            field_dict["height"] = height
        if resolution is not UNSET:
            field_dict["resolution"] = resolution
        if model is not UNSET:
            field_dict["model"] = model
        if provider is not UNSET:
            field_dict["provider"] = provider

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        prompt_text = d.pop("promptText")

        base_image = d.pop("baseImage")

        width = d.pop("width", UNSET)

        height = d.pop("height", UNSET)

        _resolution = d.pop("resolution", UNSET)
        resolution: PostMockupsGenerateBodyResolution | Unset
        if isinstance(_resolution, Unset):
            resolution = UNSET
        else:
            resolution = PostMockupsGenerateBodyResolution(_resolution)

        _model = d.pop("model", UNSET)
        model: PostMockupsGenerateBodyModel | Unset
        if isinstance(_model, Unset):
            model = UNSET
        else:
            model = PostMockupsGenerateBodyModel(_model)

        _provider = d.pop("provider", UNSET)
        provider: PostMockupsGenerateBodyProvider | Unset
        if isinstance(_provider, Unset):
            provider = UNSET
        else:
            provider = PostMockupsGenerateBodyProvider(_provider)

        post_mockups_generate_body = cls(
            prompt_text=prompt_text,
            base_image=base_image,
            width=width,
            height=height,
            resolution=resolution,
            model=model,
            provider=provider,
        )

        post_mockups_generate_body.additional_properties = d
        return post_mockups_generate_body

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
