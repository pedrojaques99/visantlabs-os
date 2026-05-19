from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_brand_guidelines_public_slug_context_response_404 import (
    GetBrandGuidelinesPublicSlugContextResponse404,
)
from ...types import UNSET, Response, Unset


def _get_kwargs(
    slug: str,
    *,
    format_: str | Unset = UNSET,
    output: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["format"] = format_

    params["output"] = output

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/brand-guidelines/public/{slug}/context".format(
            slug=quote(str(slug), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetBrandGuidelinesPublicSlugContextResponse404 | None:
    if response.status_code == 404:
        response_404 = GetBrandGuidelinesPublicSlugContextResponse404.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetBrandGuidelinesPublicSlugContextResponse404]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
    format_: str | Unset = UNSET,
    output: str | Unset = UNSET,
) -> Response[GetBrandGuidelinesPublicSlugContextResponse404]:
    """Get brand context for LLMs

     Returns LLM-ready formatted brand context. Perfect for AI agents and MCP integrations. No
    authentication required.

    Args:
        slug (str): Public slug of the brand guideline Example: acme-corp.
        format_ (str | Unset): Output format: full (default) or compact (optimized for image gen)
            Example: compact.
        output (str | Unset): Response type: text (default) or json Example: json.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetBrandGuidelinesPublicSlugContextResponse404]
    """

    kwargs = _get_kwargs(
        slug=slug,
        format_=format_,
        output=output,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
    format_: str | Unset = UNSET,
    output: str | Unset = UNSET,
) -> GetBrandGuidelinesPublicSlugContextResponse404 | None:
    """Get brand context for LLMs

     Returns LLM-ready formatted brand context. Perfect for AI agents and MCP integrations. No
    authentication required.

    Args:
        slug (str): Public slug of the brand guideline Example: acme-corp.
        format_ (str | Unset): Output format: full (default) or compact (optimized for image gen)
            Example: compact.
        output (str | Unset): Response type: text (default) or json Example: json.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetBrandGuidelinesPublicSlugContextResponse404
    """

    return sync_detailed(
        slug=slug,
        client=client,
        format_=format_,
        output=output,
    ).parsed


async def asyncio_detailed(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
    format_: str | Unset = UNSET,
    output: str | Unset = UNSET,
) -> Response[GetBrandGuidelinesPublicSlugContextResponse404]:
    """Get brand context for LLMs

     Returns LLM-ready formatted brand context. Perfect for AI agents and MCP integrations. No
    authentication required.

    Args:
        slug (str): Public slug of the brand guideline Example: acme-corp.
        format_ (str | Unset): Output format: full (default) or compact (optimized for image gen)
            Example: compact.
        output (str | Unset): Response type: text (default) or json Example: json.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetBrandGuidelinesPublicSlugContextResponse404]
    """

    kwargs = _get_kwargs(
        slug=slug,
        format_=format_,
        output=output,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
    format_: str | Unset = UNSET,
    output: str | Unset = UNSET,
) -> GetBrandGuidelinesPublicSlugContextResponse404 | None:
    """Get brand context for LLMs

     Returns LLM-ready formatted brand context. Perfect for AI agents and MCP integrations. No
    authentication required.

    Args:
        slug (str): Public slug of the brand guideline Example: acme-corp.
        format_ (str | Unset): Output format: full (default) or compact (optimized for image gen)
            Example: compact.
        output (str | Unset): Response type: text (default) or json Example: json.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetBrandGuidelinesPublicSlugContextResponse404
    """

    return (
        await asyncio_detailed(
            slug=slug,
            client=client,
            format_=format_,
            output=output,
        )
    ).parsed
