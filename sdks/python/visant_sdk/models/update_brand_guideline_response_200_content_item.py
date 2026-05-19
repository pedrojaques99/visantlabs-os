from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.update_brand_guideline_response_200_content_item_type import (
    UpdateBrandGuidelineResponse200ContentItemType,
)

T = TypeVar("T", bound="UpdateBrandGuidelineResponse200ContentItem")


@_attrs_define
class UpdateBrandGuidelineResponse200ContentItem:
    """
    Attributes:
        type_ (UpdateBrandGuidelineResponse200ContentItemType):
        text (str):
    """

    type_: UpdateBrandGuidelineResponse200ContentItemType
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
        type_ = UpdateBrandGuidelineResponse200ContentItemType(d.pop("type"))

        text = d.pop("text")

        update_brand_guideline_response_200_content_item = cls(
            type_=type_,
            text=text,
        )

        update_brand_guideline_response_200_content_item.additional_properties = d
        return update_brand_guideline_response_200_content_item

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
