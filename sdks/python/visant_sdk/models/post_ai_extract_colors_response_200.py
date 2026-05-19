from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_ai_extract_colors_response_200_colors_item import PostAiExtractColorsResponse200ColorsItem


T = TypeVar("T", bound="PostAiExtractColorsResponse200")


@_attrs_define
class PostAiExtractColorsResponse200:
    """
    Attributes:
        colors (list[PostAiExtractColorsResponse200ColorsItem] | Unset):
    """

    colors: list[PostAiExtractColorsResponse200ColorsItem] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        colors: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.colors, Unset):
            colors = []
            for colors_item_data in self.colors:
                colors_item = colors_item_data.to_dict()
                colors.append(colors_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if colors is not UNSET:
            field_dict["colors"] = colors

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_ai_extract_colors_response_200_colors_item import PostAiExtractColorsResponse200ColorsItem

        d = dict(src_dict)
        _colors = d.pop("colors", UNSET)
        colors: list[PostAiExtractColorsResponse200ColorsItem] | Unset = UNSET
        if _colors is not UNSET:
            colors = []
            for colors_item_data in _colors:
                colors_item = PostAiExtractColorsResponse200ColorsItem.from_dict(colors_item_data)

                colors.append(colors_item)

        post_ai_extract_colors_response_200 = cls(
            colors=colors,
        )

        post_ai_extract_colors_response_200.additional_properties = d
        return post_ai_extract_colors_response_200

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
