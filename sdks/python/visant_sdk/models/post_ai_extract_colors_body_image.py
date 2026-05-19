from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostAiExtractColorsBodyImage")


@_attrs_define
class PostAiExtractColorsBodyImage:
    """
    Attributes:
        url (str | Unset):
        base64 (str | Unset):
        mime_type (str | Unset):
    """

    url: str | Unset = UNSET
    base64: str | Unset = UNSET
    mime_type: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        url = self.url

        base64 = self.base64

        mime_type = self.mime_type

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if url is not UNSET:
            field_dict["url"] = url
        if base64 is not UNSET:
            field_dict["base64"] = base64
        if mime_type is not UNSET:
            field_dict["mimeType"] = mime_type

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        url = d.pop("url", UNSET)

        base64 = d.pop("base64", UNSET)

        mime_type = d.pop("mimeType", UNSET)

        post_ai_extract_colors_body_image = cls(
            url=url,
            base64=base64,
            mime_type=mime_type,
        )

        post_ai_extract_colors_body_image.additional_properties = d
        return post_ai_extract_colors_body_image

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
