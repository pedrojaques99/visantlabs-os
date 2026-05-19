from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_brand_design_system_body import GetBrandDesignSystemBody
from ...models.get_brand_design_system_response_200 import GetBrandDesignSystemResponse200
from ...models.get_brand_design_system_response_401 import GetBrandDesignSystemResponse401
from ...models.get_brand_design_system_response_402 import GetBrandDesignSystemResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: GetBrandDesignSystemBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/get_brand_design_system",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetBrandDesignSystemResponse200 | GetBrandDesignSystemResponse401 | GetBrandDesignSystemResponse402 | None:
    if response.status_code == 200:
        response_200 = GetBrandDesignSystemResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = GetBrandDesignSystemResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = GetBrandDesignSystemResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetBrandDesignSystemResponse200 | GetBrandDesignSystemResponse401 | GetBrandDesignSystemResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: GetBrandDesignSystemBody,
) -> Response[GetBrandDesignSystemResponse200 | GetBrandDesignSystemResponse401 | GetBrandDesignSystemResponse402]:
    """Get a structured LLM-ready design system context for a brand.

     Get a structured LLM-ready design system context for a brand. Returns colors with semantic roles,
    typography with intent, spacing/radius tokens, shadows, gradients, motion tokens, and borders —
    formatted as a concise JSON optimized for AI code generation and design decisions.

    Args:
        body (GetBrandDesignSystemBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetBrandDesignSystemResponse200 | GetBrandDesignSystemResponse401 | GetBrandDesignSystemResponse402]
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
    body: GetBrandDesignSystemBody,
) -> GetBrandDesignSystemResponse200 | GetBrandDesignSystemResponse401 | GetBrandDesignSystemResponse402 | None:
    """Get a structured LLM-ready design system context for a brand.

     Get a structured LLM-ready design system context for a brand. Returns colors with semantic roles,
    typography with intent, spacing/radius tokens, shadows, gradients, motion tokens, and borders —
    formatted as a concise JSON optimized for AI code generation and design decisions.

    Args:
        body (GetBrandDesignSystemBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetBrandDesignSystemResponse200 | GetBrandDesignSystemResponse401 | GetBrandDesignSystemResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: GetBrandDesignSystemBody,
) -> Response[GetBrandDesignSystemResponse200 | GetBrandDesignSystemResponse401 | GetBrandDesignSystemResponse402]:
    """Get a structured LLM-ready design system context for a brand.

     Get a structured LLM-ready design system context for a brand. Returns colors with semantic roles,
    typography with intent, spacing/radius tokens, shadows, gradients, motion tokens, and borders —
    formatted as a concise JSON optimized for AI code generation and design decisions.

    Args:
        body (GetBrandDesignSystemBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetBrandDesignSystemResponse200 | GetBrandDesignSystemResponse401 | GetBrandDesignSystemResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: GetBrandDesignSystemBody,
) -> GetBrandDesignSystemResponse200 | GetBrandDesignSystemResponse401 | GetBrandDesignSystemResponse402 | None:
    """Get a structured LLM-ready design system context for a brand.

     Get a structured LLM-ready design system context for a brand. Returns colors with semantic roles,
    typography with intent, spacing/radius tokens, shadows, gradients, motion tokens, and borders —
    formatted as a concise JSON optimized for AI code generation and design decisions.

    Args:
        body (GetBrandDesignSystemBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetBrandDesignSystemResponse200 | GetBrandDesignSystemResponse401 | GetBrandDesignSystemResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
