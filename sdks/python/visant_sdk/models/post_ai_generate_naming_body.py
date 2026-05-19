from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostAiGenerateNamingBody")


@_attrs_define
class PostAiGenerateNamingBody:
    """
    Attributes:
        brief (str): Brand or product description
        count (int | Unset): Number of name suggestions Default: 10.
        style (str | Unset): Naming style (invented word, metaphor, compound, real word)
        brand_guideline_id (str | Unset):
    """

    brief: str
    count: int | Unset = 10
    style: str | Unset = UNSET
    brand_guideline_id: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        brief = self.brief

        count = self.count

        style = self.style

        brand_guideline_id = self.brand_guideline_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "brief": brief,
            }
        )
        if count is not UNSET:
            field_dict["count"] = count
        if style is not UNSET:
            field_dict["style"] = style
        if brand_guideline_id is not UNSET:
            field_dict["brandGuidelineId"] = brand_guideline_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        brief = d.pop("brief")

        count = d.pop("count", UNSET)

        style = d.pop("style", UNSET)

        brand_guideline_id = d.pop("brandGuidelineId", UNSET)

        post_ai_generate_naming_body = cls(
            brief=brief,
            count=count,
            style=style,
            brand_guideline_id=brand_guideline_id,
        )

        post_ai_generate_naming_body.additional_properties = d
        return post_ai_generate_naming_body

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
