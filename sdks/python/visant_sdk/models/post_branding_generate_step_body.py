from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.post_branding_generate_step_body_step import PostBrandingGenerateStepBodyStep
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_branding_generate_step_body_previous_data import PostBrandingGenerateStepBodyPreviousData


T = TypeVar("T", bound="PostBrandingGenerateStepBody")


@_attrs_define
class PostBrandingGenerateStepBody:
    """
    Attributes:
        step (PostBrandingGenerateStepBodyStep): Branding step to generate
        prompt (str): Brand or product brief
        previous_data (PostBrandingGenerateStepBodyPreviousData | Unset): Prior branding data for context-aware
            generation (e.g. { marketResearch, swot, colors })
    """

    step: PostBrandingGenerateStepBodyStep
    prompt: str
    previous_data: PostBrandingGenerateStepBodyPreviousData | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        step = self.step.value

        prompt = self.prompt

        previous_data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.previous_data, Unset):
            previous_data = self.previous_data.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "step": step,
                "prompt": prompt,
            }
        )
        if previous_data is not UNSET:
            field_dict["previousData"] = previous_data

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_branding_generate_step_body_previous_data import PostBrandingGenerateStepBodyPreviousData

        d = dict(src_dict)
        step = PostBrandingGenerateStepBodyStep(d.pop("step"))

        prompt = d.pop("prompt")

        _previous_data = d.pop("previousData", UNSET)
        previous_data: PostBrandingGenerateStepBodyPreviousData | Unset
        if isinstance(_previous_data, Unset):
            previous_data = UNSET
        else:
            previous_data = PostBrandingGenerateStepBodyPreviousData.from_dict(_previous_data)

        post_branding_generate_step_body = cls(
            step=step,
            prompt=prompt,
            previous_data=previous_data,
        )

        post_branding_generate_step_body.additional_properties = d
        return post_branding_generate_step_body

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
