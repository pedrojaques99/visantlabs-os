from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_ai_generate_naming_response_200_names_item import PostAiGenerateNamingResponse200NamesItem


T = TypeVar("T", bound="PostAiGenerateNamingResponse200")


@_attrs_define
class PostAiGenerateNamingResponse200:
    """
    Attributes:
        names (list[PostAiGenerateNamingResponse200NamesItem] | Unset):
    """

    names: list[PostAiGenerateNamingResponse200NamesItem] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        names: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.names, Unset):
            names = []
            for names_item_data in self.names:
                names_item = names_item_data.to_dict()
                names.append(names_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if names is not UNSET:
            field_dict["names"] = names

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_ai_generate_naming_response_200_names_item import PostAiGenerateNamingResponse200NamesItem

        d = dict(src_dict)
        _names = d.pop("names", UNSET)
        names: list[PostAiGenerateNamingResponse200NamesItem] | Unset = UNSET
        if _names is not UNSET:
            names = []
            for names_item_data in _names:
                names_item = PostAiGenerateNamingResponse200NamesItem.from_dict(names_item_data)

                names.append(names_item)

        post_ai_generate_naming_response_200 = cls(
            names=names,
        )

        post_ai_generate_naming_response_200.additional_properties = d
        return post_ai_generate_naming_response_200

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
