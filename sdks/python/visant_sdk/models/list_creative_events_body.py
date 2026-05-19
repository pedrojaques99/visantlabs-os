from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ListCreativeEventsBody")


@_attrs_define
class ListCreativeEventsBody:
    """
    Attributes:
        brand_id (str | Unset):
        creative_id (str | Unset):
        limit (float | Unset):  Default: 100.0.
    """

    brand_id: str | Unset = UNSET
    creative_id: str | Unset = UNSET
    limit: float | Unset = 100.0
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        brand_id = self.brand_id

        creative_id = self.creative_id

        limit = self.limit

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if brand_id is not UNSET:
            field_dict["brandId"] = brand_id
        if creative_id is not UNSET:
            field_dict["creativeId"] = creative_id
        if limit is not UNSET:
            field_dict["limit"] = limit

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        brand_id = d.pop("brandId", UNSET)

        creative_id = d.pop("creativeId", UNSET)

        limit = d.pop("limit", UNSET)

        list_creative_events_body = cls(
            brand_id=brand_id,
            creative_id=creative_id,
            limit=limit,
        )

        list_creative_events_body.additional_properties = d
        return list_creative_events_body

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
