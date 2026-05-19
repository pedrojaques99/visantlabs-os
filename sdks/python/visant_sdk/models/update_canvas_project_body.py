from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.update_canvas_project_body_data import UpdateCanvasProjectBodyData


T = TypeVar("T", bound="UpdateCanvasProjectBody")


@_attrs_define
class UpdateCanvasProjectBody:
    """
    Attributes:
        canvas_id (str): Canvas project ID
        data (UpdateCanvasProjectBodyData): Canvas data to update
    """

    canvas_id: str
    data: UpdateCanvasProjectBodyData
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        canvas_id = self.canvas_id

        data = self.data.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "canvasId": canvas_id,
                "data": data,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_canvas_project_body_data import UpdateCanvasProjectBodyData

        d = dict(src_dict)
        canvas_id = d.pop("canvasId")

        data = UpdateCanvasProjectBodyData.from_dict(d.pop("data"))

        update_canvas_project_body = cls(
            canvas_id=canvas_id,
            data=data,
        )

        update_canvas_project_body.additional_properties = d
        return update_canvas_project_body

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
