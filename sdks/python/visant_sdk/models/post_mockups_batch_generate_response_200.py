from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_mockups_batch_generate_response_200_results_item import (
        PostMockupsBatchGenerateResponse200ResultsItem,
    )


T = TypeVar("T", bound="PostMockupsBatchGenerateResponse200")


@_attrs_define
class PostMockupsBatchGenerateResponse200:
    """
    Attributes:
        total (int | Unset):
        results (list[PostMockupsBatchGenerateResponse200ResultsItem] | Unset):
    """

    total: int | Unset = UNSET
    results: list[PostMockupsBatchGenerateResponse200ResultsItem] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        total = self.total

        results: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.results, Unset):
            results = []
            for results_item_data in self.results:
                results_item = results_item_data.to_dict()
                results.append(results_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if total is not UNSET:
            field_dict["total"] = total
        if results is not UNSET:
            field_dict["results"] = results

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_mockups_batch_generate_response_200_results_item import (
            PostMockupsBatchGenerateResponse200ResultsItem,
        )

        d = dict(src_dict)
        total = d.pop("total", UNSET)

        _results = d.pop("results", UNSET)
        results: list[PostMockupsBatchGenerateResponse200ResultsItem] | Unset = UNSET
        if _results is not UNSET:
            results = []
            for results_item_data in _results:
                results_item = PostMockupsBatchGenerateResponse200ResultsItem.from_dict(results_item_data)

                results.append(results_item)

        post_mockups_batch_generate_response_200 = cls(
            total=total,
            results=results,
        )

        post_mockups_batch_generate_response_200.additional_properties = d
        return post_mockups_batch_generate_response_200

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
