from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.extract_prompt_from_image_body import ExtractPromptFromImageBody
from ...models.extract_prompt_from_image_response_200 import ExtractPromptFromImageResponse200
from ...models.extract_prompt_from_image_response_401 import ExtractPromptFromImageResponse401
from ...models.extract_prompt_from_image_response_402 import ExtractPromptFromImageResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: ExtractPromptFromImageBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/extract_prompt_from_image",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ExtractPromptFromImageResponse200 | ExtractPromptFromImageResponse401 | ExtractPromptFromImageResponse402 | None:
    if response.status_code == 200:
        response_200 = ExtractPromptFromImageResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = ExtractPromptFromImageResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = ExtractPromptFromImageResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    ExtractPromptFromImageResponse200 | ExtractPromptFromImageResponse401 | ExtractPromptFromImageResponse402
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: ExtractPromptFromImageBody,
) -> Response[
    ExtractPromptFromImageResponse200 | ExtractPromptFromImageResponse401 | ExtractPromptFromImageResponse402
]:
    """Reverse-engineer a descriptive prompt from an image (URL or base64).

     Reverse-engineer a descriptive prompt from an image (URL or base64). Useful for replicating a visual
    style.

    Args:
        body (ExtractPromptFromImageBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ExtractPromptFromImageResponse200 | ExtractPromptFromImageResponse401 | ExtractPromptFromImageResponse402]
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
    body: ExtractPromptFromImageBody,
) -> ExtractPromptFromImageResponse200 | ExtractPromptFromImageResponse401 | ExtractPromptFromImageResponse402 | None:
    """Reverse-engineer a descriptive prompt from an image (URL or base64).

     Reverse-engineer a descriptive prompt from an image (URL or base64). Useful for replicating a visual
    style.

    Args:
        body (ExtractPromptFromImageBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ExtractPromptFromImageResponse200 | ExtractPromptFromImageResponse401 | ExtractPromptFromImageResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: ExtractPromptFromImageBody,
) -> Response[
    ExtractPromptFromImageResponse200 | ExtractPromptFromImageResponse401 | ExtractPromptFromImageResponse402
]:
    """Reverse-engineer a descriptive prompt from an image (URL or base64).

     Reverse-engineer a descriptive prompt from an image (URL or base64). Useful for replicating a visual
    style.

    Args:
        body (ExtractPromptFromImageBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ExtractPromptFromImageResponse200 | ExtractPromptFromImageResponse401 | ExtractPromptFromImageResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: ExtractPromptFromImageBody,
) -> ExtractPromptFromImageResponse200 | ExtractPromptFromImageResponse401 | ExtractPromptFromImageResponse402 | None:
    """Reverse-engineer a descriptive prompt from an image (URL or base64).

     Reverse-engineer a descriptive prompt from an image (URL or base64). Useful for replicating a visual
    style.

    Args:
        body (ExtractPromptFromImageBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ExtractPromptFromImageResponse200 | ExtractPromptFromImageResponse401 | ExtractPromptFromImageResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
