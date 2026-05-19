from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.post_ai_extract_colors_body import PostAiExtractColorsBody
from ...models.post_ai_extract_colors_response_200 import PostAiExtractColorsResponse200
from ...types import Response


def _get_kwargs(
    *,
    body: PostAiExtractColorsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/ai/extract-colors",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PostAiExtractColorsResponse200 | None:
    if response.status_code == 200:
        response_200 = PostAiExtractColorsResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[PostAiExtractColorsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: PostAiExtractColorsBody,
) -> Response[PostAiExtractColorsResponse200]:
    """Extract dominant color palette from an image

     Analyze an image and return hex codes, color names, semantic roles
    (primary/accent/background/neutral), and frequency.

    Args:
        body (PostAiExtractColorsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostAiExtractColorsResponse200]
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
    body: PostAiExtractColorsBody,
) -> PostAiExtractColorsResponse200 | None:
    """Extract dominant color palette from an image

     Analyze an image and return hex codes, color names, semantic roles
    (primary/accent/background/neutral), and frequency.

    Args:
        body (PostAiExtractColorsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostAiExtractColorsResponse200
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostAiExtractColorsBody,
) -> Response[PostAiExtractColorsResponse200]:
    """Extract dominant color palette from an image

     Analyze an image and return hex codes, color names, semantic roles
    (primary/accent/background/neutral), and frequency.

    Args:
        body (PostAiExtractColorsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostAiExtractColorsResponse200]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostAiExtractColorsBody,
) -> PostAiExtractColorsResponse200 | None:
    """Extract dominant color palette from an image

     Analyze an image and return hex codes, color names, semantic roles
    (primary/accent/background/neutral), and frequency.

    Args:
        body (PostAiExtractColorsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostAiExtractColorsResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
