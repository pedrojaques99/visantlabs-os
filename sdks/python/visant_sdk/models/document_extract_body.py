from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.document_extract_body_output import DocumentExtractBodyOutput
from ..types import UNSET, Unset

T = TypeVar("T", bound="DocumentExtractBody")


@_attrs_define
class DocumentExtractBody:
    """
    Attributes:
        pdf_path (str): Absolute path to the local PDF file to extract.
        output (DocumentExtractBodyOutput): "disk" saves .md alongside the PDF. "inline" returns markdownText in the
            response.
        include_brand_tokens (bool | Unset): Include colors, typography, strategy, assetClassifications. Default: true.
    """

    pdf_path: str
    output: DocumentExtractBodyOutput
    include_brand_tokens: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        pdf_path = self.pdf_path

        output = self.output.value

        include_brand_tokens = self.include_brand_tokens

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "pdf_path": pdf_path,
                "output": output,
            }
        )
        if include_brand_tokens is not UNSET:
            field_dict["include_brand_tokens"] = include_brand_tokens

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        pdf_path = d.pop("pdf_path")

        output = DocumentExtractBodyOutput(d.pop("output"))

        include_brand_tokens = d.pop("include_brand_tokens", UNSET)

        document_extract_body = cls(
            pdf_path=pdf_path,
            output=output,
            include_brand_tokens=include_brand_tokens,
        )

        document_extract_body.additional_properties = d
        return document_extract_body

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
