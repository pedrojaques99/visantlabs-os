from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.generate_color_palettes_body_previous_data import GenerateColorPalettesBodyPreviousData


T = TypeVar("T", bound="GenerateColorPalettesBody")


@_attrs_define
class GenerateColorPalettesBody:
    """
    Attributes:
        prompt (str): Brand or product brief
        previous_data (GenerateColorPalettesBodyPreviousData | Unset): Optional prior branding data (swot, references)
    """

    prompt: str
    previous_data: GenerateColorPalettesBodyPreviousData | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        prompt = self.prompt

        previous_data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.previous_data, Unset):
            previous_data = self.previous_data.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "prompt": prompt,
            }
        )
        if previous_data is not UNSET:
            field_dict["previousData"] = previous_data

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.generate_color_palettes_body_previous_data import GenerateColorPalettesBodyPreviousData

        d = dict(src_dict)
        prompt = d.pop("prompt")

        _previous_data = d.pop("previousData", UNSET)
        previous_data: GenerateColorPalettesBodyPreviousData | Unset
        if isinstance(_previous_data, Unset):
            previous_data = UNSET
        else:
            previous_data = GenerateColorPalettesBodyPreviousData.from_dict(_previous_data)

        generate_color_palettes_body = cls(
            prompt=prompt,
            previous_data=previous_data,
        )

        generate_color_palettes_body.additional_properties = d
        return generate_color_palettes_body

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
