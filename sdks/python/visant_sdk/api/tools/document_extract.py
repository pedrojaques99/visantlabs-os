from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.document_extract_body import DocumentExtractBody
from ...models.document_extract_response_200 import DocumentExtractResponse200
from ...models.document_extract_response_401 import DocumentExtractResponse401
from ...models.document_extract_response_402 import DocumentExtractResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: DocumentExtractBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/document_extract",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> DocumentExtractResponse200 | DocumentExtractResponse401 | DocumentExtractResponse402 | None:
    if response.status_code == 200:
        response_200 = DocumentExtractResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = DocumentExtractResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = DocumentExtractResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[DocumentExtractResponse200 | DocumentExtractResponse401 | DocumentExtractResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: DocumentExtractBody,
) -> Response[DocumentExtractResponse200 | DocumentExtractResponse401 | DocumentExtractResponse402]:
    r"""Extract content from a local PDF file using a 2-phase pipeline: algorithmic (exact colors, fonts,
    embedded images) then Gemini semantic analysis (strategy, personas, voice, dos/donts, asset
    classification).

     Extract content from a local PDF file using a 2-phase pipeline: algorithmic (exact colors, fonts,
    embedded images) then Gemini semantic analysis (strategy, personas, voice, dos/donts, asset
    classification). Returns markdownText (structured, page-separated — ideal for RAG chunking) plus
    brand tokens. IMPORTANT: before calling, ask the user: \"Quer salvar o .md em disco ou receber o
    texto inline?\"

    Args:
        body (DocumentExtractBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DocumentExtractResponse200 | DocumentExtractResponse401 | DocumentExtractResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    body: DocumentExtractBody,
) -> DocumentExtractResponse200 | DocumentExtractResponse401 | DocumentExtractResponse402 | None:
    r"""Extract content from a local PDF file using a 2-phase pipeline: algorithmic (exact colors, fonts,
    embedded images) then Gemini semantic analysis (strategy, personas, voice, dos/donts, asset
    classification).

     Extract content from a local PDF file using a 2-phase pipeline: algorithmic (exact colors, fonts,
    embedded images) then Gemini semantic analysis (strategy, personas, voice, dos/donts, asset
    classification). Returns markdownText (structured, page-separated — ideal for RAG chunking) plus
    brand tokens. IMPORTANT: before calling, ask the user: \"Quer salvar o .md em disco ou receber o
    texto inline?\"

    Args:
        body (DocumentExtractBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DocumentExtractResponse200 | DocumentExtractResponse401 | DocumentExtractResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: DocumentExtractBody,
) -> Response[DocumentExtractResponse200 | DocumentExtractResponse401 | DocumentExtractResponse402]:
    r"""Extract content from a local PDF file using a 2-phase pipeline: algorithmic (exact colors, fonts,
    embedded images) then Gemini semantic analysis (strategy, personas, voice, dos/donts, asset
    classification).

     Extract content from a local PDF file using a 2-phase pipeline: algorithmic (exact colors, fonts,
    embedded images) then Gemini semantic analysis (strategy, personas, voice, dos/donts, asset
    classification). Returns markdownText (structured, page-separated — ideal for RAG chunking) plus
    brand tokens. IMPORTANT: before calling, ask the user: \"Quer salvar o .md em disco ou receber o
    texto inline?\"

    Args:
        body (DocumentExtractBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DocumentExtractResponse200 | DocumentExtractResponse401 | DocumentExtractResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: DocumentExtractBody,
) -> DocumentExtractResponse200 | DocumentExtractResponse401 | DocumentExtractResponse402 | None:
    r"""Extract content from a local PDF file using a 2-phase pipeline: algorithmic (exact colors, fonts,
    embedded images) then Gemini semantic analysis (strategy, personas, voice, dos/donts, asset
    classification).

     Extract content from a local PDF file using a 2-phase pipeline: algorithmic (exact colors, fonts,
    embedded images) then Gemini semantic analysis (strategy, personas, voice, dos/donts, asset
    classification). Returns markdownText (structured, page-separated — ideal for RAG chunking) plus
    brand tokens. IMPORTANT: before calling, ask the user: \"Quer salvar o .md em disco ou receber o
    texto inline?\"

    Args:
        body (DocumentExtractBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DocumentExtractResponse200 | DocumentExtractResponse401 | DocumentExtractResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
