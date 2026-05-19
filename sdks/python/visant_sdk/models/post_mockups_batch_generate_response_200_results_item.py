from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_mockups_batch_generate_response_200_results_item_data import (
        PostMockupsBatchGenerateResponse200ResultsItemData,
    )


T = TypeVar("T", bound="PostMockupsBatchGenerateResponse200ResultsItem")


@_attrs_define
class PostMockupsBatchGenerateResponse200ResultsItem:
    """
    Attributes:
        index (int | Unset):
        success (bool | Unset):
        data (PostMockupsBatchGenerateResponse200ResultsItemData | Unset):
        error (str | Unset):
    """

    index: int | Unset = UNSET
    success: bool | Unset = UNSET
    data: PostMockupsBatchGenerateResponse200ResultsItemData | Unset = UNSET
    error: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        index = self.index

        success = self.success

        data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.data, Unset):
            data = self.data.to_dict()

        error = self.error

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if index is not UNSET:
            field_dict["index"] = index
        if success is not UNSET:
            field_dict["success"] = success
        if data is not UNSET:
            field_dict["data"] = data
        if error is not UNSET:
            field_dict["error"] = error

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_mockups_batch_generate_response_200_results_item_data import (
            PostMockupsBatchGenerateResponse200ResultsItemData,
        )

        d = dict(src_dict)
        index = d.pop("index", UNSET)

        success = d.pop("success", UNSET)

        _data = d.pop("data", UNSET)
        data: PostMockupsBatchGenerateResponse200ResultsItemData | Unset
        if isinstance(_data, Unset):
            data = UNSET
        else:
            data = PostMockupsBatchGenerateResponse200ResultsItemData.from_dict(_data)

        error = d.pop("error", UNSET)

        post_mockups_batch_generate_response_200_results_item = cls(
            index=index,
            success=success,
            data=data,
            error=error,
        )

        post_mockups_batch_generate_response_200_results_item.additional_properties = d
        return post_mockups_batch_generate_response_200_results_item

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
