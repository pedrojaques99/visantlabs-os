from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.create_creative_plan_body_format import CreateCreativePlanBodyFormat
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.create_creative_plan_body_brand_context import CreateCreativePlanBodyBrandContext


T = TypeVar("T", bound="CreateCreativePlanBody")


@_attrs_define
class CreateCreativePlanBody:
    """
    Attributes:
        prompt (str): Creative brief / user intent
        format_ (CreateCreativePlanBodyFormat): Aspect ratio of the creative
        brand_id (str | Unset): Optional brand guideline id for brand-aware generation
        brand_context (CreateCreativePlanBodyBrandContext | Unset): Inline brand context if brandId is not available
    """

    prompt: str
    format_: CreateCreativePlanBodyFormat
    brand_id: str | Unset = UNSET
    brand_context: CreateCreativePlanBodyBrandContext | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        prompt = self.prompt

        format_ = self.format_.value

        brand_id = self.brand_id

        brand_context: dict[str, Any] | Unset = UNSET
        if not isinstance(self.brand_context, Unset):
            brand_context = self.brand_context.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "prompt": prompt,
                "format": format_,
            }
        )
        if brand_id is not UNSET:
            field_dict["brandId"] = brand_id
        if brand_context is not UNSET:
            field_dict["brandContext"] = brand_context

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_creative_plan_body_brand_context import CreateCreativePlanBodyBrandContext

        d = dict(src_dict)
        prompt = d.pop("prompt")

        format_ = CreateCreativePlanBodyFormat(d.pop("format"))

        brand_id = d.pop("brandId", UNSET)

        _brand_context = d.pop("brandContext", UNSET)
        brand_context: CreateCreativePlanBodyBrandContext | Unset
        if isinstance(_brand_context, Unset):
            brand_context = UNSET
        else:
            brand_context = CreateCreativePlanBodyBrandContext.from_dict(_brand_context)

        create_creative_plan_body = cls(
            prompt=prompt,
            format_=format_,
            brand_id=brand_id,
            brand_context=brand_context,
        )

        create_creative_plan_body.additional_properties = d
        return create_creative_plan_body

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
