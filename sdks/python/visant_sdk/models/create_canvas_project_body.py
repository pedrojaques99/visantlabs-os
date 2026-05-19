from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.create_canvas_project_body_data import CreateCanvasProjectBodyData


T = TypeVar("T", bound="CreateCanvasProjectBody")


@_attrs_define
class CreateCanvasProjectBody:
    """
    Attributes:
        name (str): Project name
        data (CreateCanvasProjectBodyData | Unset): Initial canvas data (nodes, edges, etc.)
    """

    name: str
    data: CreateCanvasProjectBodyData | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.data, Unset):
            data = self.data.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
            }
        )
        if data is not UNSET:
            field_dict["data"] = data

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_canvas_project_body_data import CreateCanvasProjectBodyData

        d = dict(src_dict)
        name = d.pop("name")

        _data = d.pop("data", UNSET)
        data: CreateCanvasProjectBodyData | Unset
        if isinstance(_data, Unset):
            data = UNSET
        else:
            data = CreateCanvasProjectBodyData.from_dict(_data)

        create_canvas_project_body = cls(
            name=name,
            data=data,
        )

        create_canvas_project_body.additional_properties = d
        return create_canvas_project_body

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
