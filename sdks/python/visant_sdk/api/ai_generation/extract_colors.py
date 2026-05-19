from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.extract_colors_body import ExtractColorsBody
from ...models.extract_colors_response_200 import ExtractColorsResponse200
from ...models.extract_colors_response_401 import ExtractColorsResponse401
from ...models.extract_colors_response_402 import ExtractColorsResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: ExtractColorsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/extract_colors",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ExtractColorsResponse200 | ExtractColorsResponse401 | ExtractColorsResponse402 | None:
    if response.status_code == 200:
        response_200 = ExtractColorsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = ExtractColorsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = ExtractColorsResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[ExtractColorsResponse200 | ExtractColorsResponse401 | ExtractColorsResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: ExtractColorsBody,
) -> Response[ExtractColorsResponse200 | ExtractColorsResponse401 | ExtractColorsResponse402]:
    """Extract a dominant color palette from an image (URL or base64).

     Extract a dominant color palette from an image (URL or base64). Returns hex codes, color names,
    semantic roles (primary/accent/etc.) and frequency.

    Args:
        body (ExtractColorsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ExtractColorsResponse200 | ExtractColorsResponse401 | ExtractColorsResponse402]
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
    body: ExtractColorsBody,
) -> ExtractColorsResponse200 | ExtractColorsResponse401 | ExtractColorsResponse402 | None:
    """Extract a dominant color palette from an image (URL or base64).

     Extract a dominant color palette from an image (URL or base64). Returns hex codes, color names,
    semantic roles (primary/accent/etc.) and frequency.

    Args:
        body (ExtractColorsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ExtractColorsResponse200 | ExtractColorsResponse401 | ExtractColorsResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: ExtractColorsBody,
) -> Response[ExtractColorsResponse200 | ExtractColorsResponse401 | ExtractColorsResponse402]:
    """Extract a dominant color palette from an image (URL or base64).

     Extract a dominant color palette from an image (URL or base64). Returns hex codes, color names,
    semantic roles (primary/accent/etc.) and frequency.

    Args:
        body (ExtractColorsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ExtractColorsResponse200 | ExtractColorsResponse401 | ExtractColorsResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: ExtractColorsBody,
) -> ExtractColorsResponse200 | ExtractColorsResponse401 | ExtractColorsResponse402 | None:
    """Extract a dominant color palette from an image (URL or base64).

     Extract a dominant color palette from an image (URL or base64). Returns hex codes, color names,
    semantic roles (primary/accent/etc.) and frequency.

    Args:
        body (ExtractColorsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ExtractColorsResponse200 | ExtractColorsResponse401 | ExtractColorsResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
