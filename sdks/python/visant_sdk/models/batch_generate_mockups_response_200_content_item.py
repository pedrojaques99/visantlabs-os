from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.batch_generate_mockups_response_200_content_item_type import (
    BatchGenerateMockupsResponse200ContentItemType,
)

T = TypeVar("T", bound="BatchGenerateMockupsResponse200ContentItem")


@_attrs_define
class BatchGenerateMockupsResponse200ContentItem:
    """
    Attributes:
        type_ (BatchGenerateMockupsResponse200ContentItemType):
        text (str):
    """

    type_: BatchGenerateMockupsResponse200ContentItemType
    text: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        text = self.text

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
                "text": text,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = BatchGenerateMockupsResponse200ContentItemType(d.pop("type"))

        text = d.pop("text")

        batch_generate_mockups_response_200_content_item = cls(
            type_=type_,
            text=text,
        )

        batch_generate_mockups_response_200_content_item.additional_properties = d
        return batch_generate_mockups_response_200_content_item

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
