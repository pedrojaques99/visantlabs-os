from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="CreateCreativePlanBodyBrandContext")


@_attrs_define
class CreateCreativePlanBodyBrandContext:
    """Inline brand context if brandId is not available

    Attributes:
        name (str | Unset):
        colors (list[str] | Unset):
        fonts (list[str] | Unset):
        voice (str | Unset):
        keywords (list[str] | Unset):
        has_logos (bool | Unset):
    """

    name: str | Unset = UNSET
    colors: list[str] | Unset = UNSET
    fonts: list[str] | Unset = UNSET
    voice: str | Unset = UNSET
    keywords: list[str] | Unset = UNSET
    has_logos: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        colors: list[str] | Unset = UNSET
        if not isinstance(self.colors, Unset):
            colors = self.colors

        fonts: list[str] | Unset = UNSET
        if not isinstance(self.fonts, Unset):
            fonts = self.fonts

        voice = self.voice

        keywords: list[str] | Unset = UNSET
        if not isinstance(self.keywords, Unset):
            keywords = self.keywords

        has_logos = self.has_logos

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if colors is not UNSET:
            field_dict["colors"] = colors
        if fonts is not UNSET:
            field_dict["fonts"] = fonts
        if voice is not UNSET:
            field_dict["voice"] = voice
        if keywords is not UNSET:
            field_dict["keywords"] = keywords
        if has_logos is not UNSET:
            field_dict["hasLogos"] = has_logos

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        colors = cast(list[str], d.pop("colors", UNSET))

        fonts = cast(list[str], d.pop("fonts", UNSET))

        voice = d.pop("voice", UNSET)

        keywords = cast(list[str], d.pop("keywords", UNSET))

        has_logos = d.pop("hasLogos", UNSET)

        create_creative_plan_body_brand_context = cls(
            name=name,
            colors=colors,
            fonts=fonts,
            voice=voice,
            keywords=keywords,
            has_logos=has_logos,
        )

        create_creative_plan_body_brand_context.additional_properties = d
        return create_creative_plan_body_brand_context

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
