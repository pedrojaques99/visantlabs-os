from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.post_ai_extract_colors_response_200_colors_item_frequency import (
    PostAiExtractColorsResponse200ColorsItemFrequency,
)
from ..models.post_ai_extract_colors_response_200_colors_item_role import PostAiExtractColorsResponse200ColorsItemRole
from ..types import UNSET, Unset

T = TypeVar("T", bound="PostAiExtractColorsResponse200ColorsItem")


@_attrs_define
class PostAiExtractColorsResponse200ColorsItem:
    """
    Attributes:
        hex_ (str | Unset):
        name (str | Unset):
        role (PostAiExtractColorsResponse200ColorsItemRole | Unset):
        frequency (PostAiExtractColorsResponse200ColorsItemFrequency | Unset):
    """

    hex_: str | Unset = UNSET
    name: str | Unset = UNSET
    role: PostAiExtractColorsResponse200ColorsItemRole | Unset = UNSET
    frequency: PostAiExtractColorsResponse200ColorsItemFrequency | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        hex_ = self.hex_

        name = self.name

        role: str | Unset = UNSET
        if not isinstance(self.role, Unset):
            role = self.role.value

        frequency: str | Unset = UNSET
        if not isinstance(self.frequency, Unset):
            frequency = self.frequency.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if hex_ is not UNSET:
            field_dict["hex"] = hex_
        if name is not UNSET:
            field_dict["name"] = name
        if role is not UNSET:
            field_dict["role"] = role
        if frequency is not UNSET:
            field_dict["frequency"] = frequency

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        hex_ = d.pop("hex", UNSET)

        name = d.pop("name", UNSET)

        _role = d.pop("role", UNSET)
        role: PostAiExtractColorsResponse200ColorsItemRole | Unset
        if isinstance(_role, Unset):
            role = UNSET
        else:
            role = PostAiExtractColorsResponse200ColorsItemRole(_role)

        _frequency = d.pop("frequency", UNSET)
        frequency: PostAiExtractColorsResponse200ColorsItemFrequency | Unset
        if isinstance(_frequency, Unset):
            frequency = UNSET
        else:
            frequency = PostAiExtractColorsResponse200ColorsItemFrequency(_frequency)

        post_ai_extract_colors_response_200_colors_item = cls(
            hex_=hex_,
            name=name,
            role=role,
            frequency=frequency,
        )

        post_ai_extract_colors_response_200_colors_item.additional_properties = d
        return post_ai_extract_colors_response_200_colors_item

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
