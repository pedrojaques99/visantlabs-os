from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.batch_generate_mockups_body_prompts_item_type_1_base_image import (
        BatchGenerateMockupsBodyPromptsItemType1BaseImage,
    )
    from ..models.batch_generate_mockups_body_prompts_item_type_1_reference_images_item import (
        BatchGenerateMockupsBodyPromptsItemType1ReferenceImagesItem,
    )


T = TypeVar("T", bound="BatchGenerateMockupsBodyPromptsItemType1")


@_attrs_define
class BatchGenerateMockupsBodyPromptsItemType1:
    """
    Attributes:
        prompt_text (str):
        reference_images (list[BatchGenerateMockupsBodyPromptsItemType1ReferenceImagesItem] | Unset): Per-prompt
            reference images (e.g. brand logo URLs)
        base_image (BatchGenerateMockupsBodyPromptsItemType1BaseImage | Unset): Per-prompt base image for img2img
    """

    prompt_text: str
    reference_images: list[BatchGenerateMockupsBodyPromptsItemType1ReferenceImagesItem] | Unset = UNSET
    base_image: BatchGenerateMockupsBodyPromptsItemType1BaseImage | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        prompt_text = self.prompt_text

        reference_images: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.reference_images, Unset):
            reference_images = []
            for reference_images_item_data in self.reference_images:
                reference_images_item = reference_images_item_data.to_dict()
                reference_images.append(reference_images_item)

        base_image: dict[str, Any] | Unset = UNSET
        if not isinstance(self.base_image, Unset):
            base_image = self.base_image.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "promptText": prompt_text,
            }
        )
        if reference_images is not UNSET:
            field_dict["referenceImages"] = reference_images
        if base_image is not UNSET:
            field_dict["baseImage"] = base_image

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.batch_generate_mockups_body_prompts_item_type_1_base_image import (
            BatchGenerateMockupsBodyPromptsItemType1BaseImage,
        )
        from ..models.batch_generate_mockups_body_prompts_item_type_1_reference_images_item import (
            BatchGenerateMockupsBodyPromptsItemType1ReferenceImagesItem,
        )

        d = dict(src_dict)
        prompt_text = d.pop("promptText")

        _reference_images = d.pop("referenceImages", UNSET)
        reference_images: list[BatchGenerateMockupsBodyPromptsItemType1ReferenceImagesItem] | Unset = UNSET
        if _reference_images is not UNSET:
            reference_images = []
            for reference_images_item_data in _reference_images:
                reference_images_item = BatchGenerateMockupsBodyPromptsItemType1ReferenceImagesItem.from_dict(
                    reference_images_item_data
                )

                reference_images.append(reference_images_item)

        _base_image = d.pop("baseImage", UNSET)
        base_image: BatchGenerateMockupsBodyPromptsItemType1BaseImage | Unset
        if isinstance(_base_image, Unset):
            base_image = UNSET
        else:
            base_image = BatchGenerateMockupsBodyPromptsItemType1BaseImage.from_dict(_base_image)

        batch_generate_mockups_body_prompts_item_type_1 = cls(
            prompt_text=prompt_text,
            reference_images=reference_images,
            base_image=base_image,
        )

        batch_generate_mockups_body_prompts_item_type_1.additional_properties = d
        return batch_generate_mockups_body_prompts_item_type_1

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
