from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.create_creative_plan_body import CreateCreativePlanBody
from ...models.create_creative_plan_response_200 import CreateCreativePlanResponse200
from ...models.create_creative_plan_response_401 import CreateCreativePlanResponse401
from ...models.create_creative_plan_response_402 import CreateCreativePlanResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: CreateCreativePlanBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/create_creative_plan",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> CreateCreativePlanResponse200 | CreateCreativePlanResponse401 | CreateCreativePlanResponse402 | None:
    if response.status_code == 200:
        response_200 = CreateCreativePlanResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = CreateCreativePlanResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = CreateCreativePlanResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[CreateCreativePlanResponse200 | CreateCreativePlanResponse401 | CreateCreativePlanResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: CreateCreativePlanBody,
) -> Response[CreateCreativePlanResponse200 | CreateCreativePlanResponse401 | CreateCreativePlanResponse402]:
    """Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset.

     Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset. If
    brandId is provided, the plan is automatically biased by that brand's learned edit history.

    Args:
        body (CreateCreativePlanBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateCreativePlanResponse200 | CreateCreativePlanResponse401 | CreateCreativePlanResponse402]
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
    body: CreateCreativePlanBody,
) -> CreateCreativePlanResponse200 | CreateCreativePlanResponse401 | CreateCreativePlanResponse402 | None:
    """Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset.

     Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset. If
    brandId is provided, the plan is automatically biased by that brand's learned edit history.

    Args:
        body (CreateCreativePlanBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateCreativePlanResponse200 | CreateCreativePlanResponse401 | CreateCreativePlanResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: CreateCreativePlanBody,
) -> Response[CreateCreativePlanResponse200 | CreateCreativePlanResponse401 | CreateCreativePlanResponse402]:
    """Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset.

     Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset. If
    brandId is provided, the plan is automatically biased by that brand's learned edit history.

    Args:
        body (CreateCreativePlanBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateCreativePlanResponse200 | CreateCreativePlanResponse401 | CreateCreativePlanResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: CreateCreativePlanBody,
) -> CreateCreativePlanResponse200 | CreateCreativePlanResponse401 | CreateCreativePlanResponse402 | None:
    """Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset.

     Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset. If
    brandId is provided, the plan is automatically biased by that brand's learned edit history.

    Args:
        body (CreateCreativePlanBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateCreativePlanResponse200 | CreateCreativePlanResponse401 | CreateCreativePlanResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
