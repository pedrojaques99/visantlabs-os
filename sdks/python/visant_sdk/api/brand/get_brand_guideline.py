from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_brand_guideline_body import GetBrandGuidelineBody
from ...models.get_brand_guideline_response_200 import GetBrandGuidelineResponse200
from ...models.get_brand_guideline_response_401 import GetBrandGuidelineResponse401
from ...models.get_brand_guideline_response_402 import GetBrandGuidelineResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: GetBrandGuidelineBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/get_brand_guideline",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetBrandGuidelineResponse200 | GetBrandGuidelineResponse401 | GetBrandGuidelineResponse402 | None:
    if response.status_code == 200:
        response_200 = GetBrandGuidelineResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = GetBrandGuidelineResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = GetBrandGuidelineResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetBrandGuidelineResponse200 | GetBrandGuidelineResponse401 | GetBrandGuidelineResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: GetBrandGuidelineBody,
) -> Response[GetBrandGuidelineResponse200 | GetBrandGuidelineResponse401 | GetBrandGuidelineResponse402]:
    """Fetch the full brand guideline for a given id.

     Fetch the full brand guideline for a given id. Includes identity, colors, typography, logos, voice,
    gradients, shadows, motion tokens, borders, strategy, editorial guidelines, and validation state.
    Use this to get LLM-ready brand context before generating any brand-aware content.

    Args:
        body (GetBrandGuidelineBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetBrandGuidelineResponse200 | GetBrandGuidelineResponse401 | GetBrandGuidelineResponse402]
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
    body: GetBrandGuidelineBody,
) -> GetBrandGuidelineResponse200 | GetBrandGuidelineResponse401 | GetBrandGuidelineResponse402 | None:
    """Fetch the full brand guideline for a given id.

     Fetch the full brand guideline for a given id. Includes identity, colors, typography, logos, voice,
    gradients, shadows, motion tokens, borders, strategy, editorial guidelines, and validation state.
    Use this to get LLM-ready brand context before generating any brand-aware content.

    Args:
        body (GetBrandGuidelineBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetBrandGuidelineResponse200 | GetBrandGuidelineResponse401 | GetBrandGuidelineResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: GetBrandGuidelineBody,
) -> Response[GetBrandGuidelineResponse200 | GetBrandGuidelineResponse401 | GetBrandGuidelineResponse402]:
    """Fetch the full brand guideline for a given id.

     Fetch the full brand guideline for a given id. Includes identity, colors, typography, logos, voice,
    gradients, shadows, motion tokens, borders, strategy, editorial guidelines, and validation state.
    Use this to get LLM-ready brand context before generating any brand-aware content.

    Args:
        body (GetBrandGuidelineBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetBrandGuidelineResponse200 | GetBrandGuidelineResponse401 | GetBrandGuidelineResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: GetBrandGuidelineBody,
) -> GetBrandGuidelineResponse200 | GetBrandGuidelineResponse401 | GetBrandGuidelineResponse402 | None:
    """Fetch the full brand guideline for a given id.

     Fetch the full brand guideline for a given id. Includes identity, colors, typography, logos, voice,
    gradients, shadows, motion tokens, borders, strategy, editorial guidelines, and validation state.
    Use this to get LLM-ready brand context before generating any brand-aware content.

    Args:
        body (GetBrandGuidelineBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetBrandGuidelineResponse200 | GetBrandGuidelineResponse401 | GetBrandGuidelineResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
