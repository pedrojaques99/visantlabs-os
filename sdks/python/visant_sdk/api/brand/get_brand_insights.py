from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_brand_insights_body import GetBrandInsightsBody
from ...models.get_brand_insights_response_200 import GetBrandInsightsResponse200
from ...models.get_brand_insights_response_401 import GetBrandInsightsResponse401
from ...models.get_brand_insights_response_402 import GetBrandInsightsResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: GetBrandInsightsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/get_brand_insights",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetBrandInsightsResponse200 | GetBrandInsightsResponse401 | GetBrandInsightsResponse402 | None:
    if response.status_code == 200:
        response_200 = GetBrandInsightsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = GetBrandInsightsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = GetBrandInsightsResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetBrandInsightsResponse200 | GetBrandInsightsResponse401 | GetBrandInsightsResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: GetBrandInsightsBody,
) -> Response[GetBrandInsightsResponse200 | GetBrandInsightsResponse401 | GetBrandInsightsResponse402]:
    """Get learned brand preferences aggregated from user edit history.

     Get learned brand preferences aggregated from user edit history. Returns font-size bias, color
    overrides, logo position bias, commonly removed roles, and human-readable patches. Use this to
    understand how a brand's actual usage diverges from AI defaults.

    Args:
        body (GetBrandInsightsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetBrandInsightsResponse200 | GetBrandInsightsResponse401 | GetBrandInsightsResponse402]
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
    body: GetBrandInsightsBody,
) -> GetBrandInsightsResponse200 | GetBrandInsightsResponse401 | GetBrandInsightsResponse402 | None:
    """Get learned brand preferences aggregated from user edit history.

     Get learned brand preferences aggregated from user edit history. Returns font-size bias, color
    overrides, logo position bias, commonly removed roles, and human-readable patches. Use this to
    understand how a brand's actual usage diverges from AI defaults.

    Args:
        body (GetBrandInsightsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetBrandInsightsResponse200 | GetBrandInsightsResponse401 | GetBrandInsightsResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: GetBrandInsightsBody,
) -> Response[GetBrandInsightsResponse200 | GetBrandInsightsResponse401 | GetBrandInsightsResponse402]:
    """Get learned brand preferences aggregated from user edit history.

     Get learned brand preferences aggregated from user edit history. Returns font-size bias, color
    overrides, logo position bias, commonly removed roles, and human-readable patches. Use this to
    understand how a brand's actual usage diverges from AI defaults.

    Args:
        body (GetBrandInsightsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetBrandInsightsResponse200 | GetBrandInsightsResponse401 | GetBrandInsightsResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: GetBrandInsightsBody,
) -> GetBrandInsightsResponse200 | GetBrandInsightsResponse401 | GetBrandInsightsResponse402 | None:
    """Get learned brand preferences aggregated from user edit history.

     Get learned brand preferences aggregated from user edit history. Returns font-size bias, color
    overrides, logo position bias, commonly removed roles, and human-readable patches. Use this to
    understand how a brand's actual usage diverges from AI defaults.

    Args:
        body (GetBrandInsightsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetBrandInsightsResponse200 | GetBrandInsightsResponse401 | GetBrandInsightsResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
