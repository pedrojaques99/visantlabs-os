from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.create_ad_campaign_body_formats_item import CreateAdCampaignBodyFormatsItem
from ..models.create_ad_campaign_body_model import CreateAdCampaignBodyModel
from ..types import UNSET, Unset

T = TypeVar("T", bound="CreateAdCampaignBody")


@_attrs_define
class CreateAdCampaignBody:
    """
    Attributes:
        product_image_url (str): URL of the product photo to use as base image
        brand_guideline_id (str | Unset): Brand guideline id for brand-aware generation
        brief (str | Unset): Creative brief describing the campaign goal
        count (float | Unset): Number of ads to generate (1-20) Default: 10.0.
        formats (list[CreateAdCampaignBodyFormatsItem] | Unset): Ad formats to generate. Cycles through formats if count
            > formats.length
        model (CreateAdCampaignBodyModel | Unset): Image generation model Default:
            CreateAdCampaignBodyModel.GPT_IMAGE_1.
    """

    product_image_url: str
    brand_guideline_id: str | Unset = UNSET
    brief: str | Unset = UNSET
    count: float | Unset = 10.0
    formats: list[CreateAdCampaignBodyFormatsItem] | Unset = UNSET
    model: CreateAdCampaignBodyModel | Unset = CreateAdCampaignBodyModel.GPT_IMAGE_1
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        product_image_url = self.product_image_url

        brand_guideline_id = self.brand_guideline_id

        brief = self.brief

        count = self.count

        formats: list[str] | Unset = UNSET
        if not isinstance(self.formats, Unset):
            formats = []
            for formats_item_data in self.formats:
                formats_item = formats_item_data.value
                formats.append(formats_item)

        model: str | Unset = UNSET
        if not isinstance(self.model, Unset):
            model = self.model.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "productImageUrl": product_image_url,
            }
        )
        if brand_guideline_id is not UNSET:
            field_dict["brandGuidelineId"] = brand_guideline_id
        if brief is not UNSET:
            field_dict["brief"] = brief
        if count is not UNSET:
            field_dict["count"] = count
        if formats is not UNSET:
            field_dict["formats"] = formats
        if model is not UNSET:
            field_dict["model"] = model

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        product_image_url = d.pop("productImageUrl")

        brand_guideline_id = d.pop("brandGuidelineId", UNSET)

        brief = d.pop("brief", UNSET)

        count = d.pop("count", UNSET)

        _formats = d.pop("formats", UNSET)
        formats: list[CreateAdCampaignBodyFormatsItem] | Unset = UNSET
        if _formats is not UNSET:
            formats = []
            for formats_item_data in _formats:
                formats_item = CreateAdCampaignBodyFormatsItem(formats_item_data)

                formats.append(formats_item)

        _model = d.pop("model", UNSET)
        model: CreateAdCampaignBodyModel | Unset
        if isinstance(_model, Unset):
            model = UNSET
        else:
            model = CreateAdCampaignBodyModel(_model)

        create_ad_campaign_body = cls(
            product_image_url=product_image_url,
            brand_guideline_id=brand_guideline_id,
            brief=brief,
            count=count,
            formats=formats,
            model=model,
        )

        create_ad_campaign_body.additional_properties = d
        return create_ad_campaign_body

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
