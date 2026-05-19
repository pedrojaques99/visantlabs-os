from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.validate_brand_section_body_state import ValidateBrandSectionBodyState

T = TypeVar("T", bound="ValidateBrandSectionBody")


@_attrs_define
class ValidateBrandSectionBody:
    """
    Attributes:
        brand_id (str):
        section (str): Section name to validate
        state (ValidateBrandSectionBodyState): Validation state to set
    """

    brand_id: str
    section: str
    state: ValidateBrandSectionBodyState
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        brand_id = self.brand_id

        section = self.section

        state = self.state.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "brandId": brand_id,
                "section": section,
                "state": state,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        brand_id = d.pop("brandId")

        section = d.pop("section")

        state = ValidateBrandSectionBodyState(d.pop("state"))

        validate_brand_section_body = cls(
            brand_id=brand_id,
            section=section,
            state=state,
        )

        validate_brand_section_body.additional_properties = d
        return validate_brand_section_body

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
