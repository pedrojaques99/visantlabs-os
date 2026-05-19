from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.generate_concept_ideas_body_previous_data import GenerateConceptIdeasBodyPreviousData


T = TypeVar("T", bound="GenerateConceptIdeasBody")


@_attrs_define
class GenerateConceptIdeasBody:
    """
    Attributes:
        prompt (str): Brand or product brief
        previous_data (GenerateConceptIdeasBodyPreviousData | Unset): Optional prior branding data (persona, colors,
            archetype) for richer ideas
    """

    prompt: str
    previous_data: GenerateConceptIdeasBodyPreviousData | Unset = UNSET
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
        from ..models.generate_concept_ideas_body_previous_data import GenerateConceptIdeasBodyPreviousData

        d = dict(src_dict)
        prompt = d.pop("prompt")

        _previous_data = d.pop("previousData", UNSET)
        previous_data: GenerateConceptIdeasBodyPreviousData | Unset
        if isinstance(_previous_data, Unset):
            previous_data = UNSET
        else:
            previous_data = GenerateConceptIdeasBodyPreviousData.from_dict(_previous_data)

        generate_concept_ideas_body = cls(
            prompt=prompt,
            previous_data=previous_data,
        )

        generate_concept_ideas_body.additional_properties = d
        return generate_concept_ideas_body

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
