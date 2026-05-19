from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_brand_guidelines_public_slug_response_404 import GetBrandGuidelinesPublicSlugResponse404
from ...types import Response


def _get_kwargs(
    slug: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/brand-guidelines/public/{slug}".format(
            slug=quote(str(slug), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetBrandGuidelinesPublicSlugResponse404 | None:
    if response.status_code == 404:
        response_404 = GetBrandGuidelinesPublicSlugResponse404.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetBrandGuidelinesPublicSlugResponse404]:
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
) -> Response[GetBrandGuidelinesPublicSlugResponse404]:
    """Get public brand guideline

     Returns full brand guideline data for a public slug. No authentication required.

    Args:
        slug (str): Public slug of the brand guideline Example: acme-corp.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetBrandGuidelinesPublicSlugResponse404]
    """

    kwargs = _get_kwargs(
        slug=slug,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetBrandGuidelinesPublicSlugResponse404 | None:
    """Get public brand guideline

     Returns full brand guideline data for a public slug. No authentication required.

    Args:
        slug (str): Public slug of the brand guideline Example: acme-corp.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetBrandGuidelinesPublicSlugResponse404
    """

    return sync_detailed(
        slug=slug,
        client=client,
    ).parsed


async def asyncio_detailed(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetBrandGuidelinesPublicSlugResponse404]:
    """Get public brand guideline

     Returns full brand guideline data for a public slug. No authentication required.

    Args:
        slug (str): Public slug of the brand guideline Example: acme-corp.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetBrandGuidelinesPublicSlugResponse404]
    """

    kwargs = _get_kwargs(
        slug=slug,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetBrandGuidelinesPublicSlugResponse404 | None:
    """Get public brand guideline

     Returns full brand guideline data for a public slug. No authentication required.

    Args:
        slug (str): Public slug of the brand guideline Example: acme-corp.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetBrandGuidelinesPublicSlugResponse404
    """

    return (
        await asyncio_detailed(
            slug=slug,
            client=client,
        )
    ).parsed
