from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.generate_market_research_body import GenerateMarketResearchBody
from ...models.generate_market_research_response_200 import GenerateMarketResearchResponse200
from ...models.generate_market_research_response_401 import GenerateMarketResearchResponse401
from ...models.generate_market_research_response_402 import GenerateMarketResearchResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: GenerateMarketResearchBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/generate_market_research",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GenerateMarketResearchResponse200 | GenerateMarketResearchResponse401 | GenerateMarketResearchResponse402 | None:
    if response.status_code == 200:
        response_200 = GenerateMarketResearchResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = GenerateMarketResearchResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = GenerateMarketResearchResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    GenerateMarketResearchResponse200 | GenerateMarketResearchResponse401 | GenerateMarketResearchResponse402
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
    body: GenerateMarketResearchBody,
) -> Response[
    GenerateMarketResearchResponse200 | GenerateMarketResearchResponse401 | GenerateMarketResearchResponse402
]:
    """Generate a market benchmarking paragraph for a brand or product brief.

     Generate a market benchmarking paragraph for a brand or product brief.

    Args:
        body (GenerateMarketResearchBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GenerateMarketResearchResponse200 | GenerateMarketResearchResponse401 | GenerateMarketResearchResponse402]
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
    body: GenerateMarketResearchBody,
) -> GenerateMarketResearchResponse200 | GenerateMarketResearchResponse401 | GenerateMarketResearchResponse402 | None:
    """Generate a market benchmarking paragraph for a brand or product brief.

     Generate a market benchmarking paragraph for a brand or product brief.

    Args:
        body (GenerateMarketResearchBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GenerateMarketResearchResponse200 | GenerateMarketResearchResponse401 | GenerateMarketResearchResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: GenerateMarketResearchBody,
) -> Response[
    GenerateMarketResearchResponse200 | GenerateMarketResearchResponse401 | GenerateMarketResearchResponse402
]:
    """Generate a market benchmarking paragraph for a brand or product brief.

     Generate a market benchmarking paragraph for a brand or product brief.

    Args:
        body (GenerateMarketResearchBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GenerateMarketResearchResponse200 | GenerateMarketResearchResponse401 | GenerateMarketResearchResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: GenerateMarketResearchBody,
) -> GenerateMarketResearchResponse200 | GenerateMarketResearchResponse401 | GenerateMarketResearchResponse402 | None:
    """Generate a market benchmarking paragraph for a brand or product brief.

     Generate a market benchmarking paragraph for a brand or product brief.

    Args:
        body (GenerateMarketResearchBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GenerateMarketResearchResponse200 | GenerateMarketResearchResponse401 | GenerateMarketResearchResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
