from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.generate_market_research_response_200_content_item import GenerateMarketResearchResponse200ContentItem


T = TypeVar("T", bound="GenerateMarketResearchResponse200")


@_attrs_define
class GenerateMarketResearchResponse200:
    """
    Attributes:
        content (list[GenerateMarketResearchResponse200ContentItem]):
    """

    content: list[GenerateMarketResearchResponse200ContentItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        content = []
        for content_item_data in self.content:
            content_item = content_item_data.to_dict()
            content.append(content_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "content": content,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.generate_market_research_response_200_content_item import (
            GenerateMarketResearchResponse200ContentItem,
        )

        d = dict(src_dict)
        content = []
        _content = d.pop("content")
        for content_item_data in _content:
            content_item = GenerateMarketResearchResponse200ContentItem.from_dict(content_item_data)

            content.append(content_item)

        generate_market_research_response_200 = cls(
            content=content,
        )

        generate_market_research_response_200.additional_properties = d
        return generate_market_research_response_200

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
