from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.create_ad_campaign_body import CreateAdCampaignBody
from ...models.create_ad_campaign_response_200 import CreateAdCampaignResponse200
from ...models.create_ad_campaign_response_401 import CreateAdCampaignResponse401
from ...models.create_ad_campaign_response_402 import CreateAdCampaignResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: CreateAdCampaignBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/create_ad_campaign",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> CreateAdCampaignResponse200 | CreateAdCampaignResponse401 | CreateAdCampaignResponse402 | None:
    if response.status_code == 200:
        response_200 = CreateAdCampaignResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = CreateAdCampaignResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = CreateAdCampaignResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[CreateAdCampaignResponse200 | CreateAdCampaignResponse401 | CreateAdCampaignResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: CreateAdCampaignBody,
) -> Response[CreateAdCampaignResponse200 | CreateAdCampaignResponse401 | CreateAdCampaignResponse402]:
    """Generate a full ad campaign from a product image and brand guidelines.

     Generate a full ad campaign from a product image and brand guidelines. An LLM (GPT-4o) plans N
    distinct prompts across creative angles (benefit, social proof, urgency, lifestyle, fear,
    transformation, etc.) then generates all images in parallel using GPT-image-1 or Gemini. Returns a
    jobId for polling. Use get_campaign_results to check progress.

    Args:
        body (CreateAdCampaignBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateAdCampaignResponse200 | CreateAdCampaignResponse401 | CreateAdCampaignResponse402]
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
    body: CreateAdCampaignBody,
) -> CreateAdCampaignResponse200 | CreateAdCampaignResponse401 | CreateAdCampaignResponse402 | None:
    """Generate a full ad campaign from a product image and brand guidelines.

     Generate a full ad campaign from a product image and brand guidelines. An LLM (GPT-4o) plans N
    distinct prompts across creative angles (benefit, social proof, urgency, lifestyle, fear,
    transformation, etc.) then generates all images in parallel using GPT-image-1 or Gemini. Returns a
    jobId for polling. Use get_campaign_results to check progress.

    Args:
        body (CreateAdCampaignBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateAdCampaignResponse200 | CreateAdCampaignResponse401 | CreateAdCampaignResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: CreateAdCampaignBody,
) -> Response[CreateAdCampaignResponse200 | CreateAdCampaignResponse401 | CreateAdCampaignResponse402]:
    """Generate a full ad campaign from a product image and brand guidelines.

     Generate a full ad campaign from a product image and brand guidelines. An LLM (GPT-4o) plans N
    distinct prompts across creative angles (benefit, social proof, urgency, lifestyle, fear,
    transformation, etc.) then generates all images in parallel using GPT-image-1 or Gemini. Returns a
    jobId for polling. Use get_campaign_results to check progress.

    Args:
        body (CreateAdCampaignBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateAdCampaignResponse200 | CreateAdCampaignResponse401 | CreateAdCampaignResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: CreateAdCampaignBody,
) -> CreateAdCampaignResponse200 | CreateAdCampaignResponse401 | CreateAdCampaignResponse402 | None:
    """Generate a full ad campaign from a product image and brand guidelines.

     Generate a full ad campaign from a product image and brand guidelines. An LLM (GPT-4o) plans N
    distinct prompts across creative angles (benefit, social proof, urgency, lifestyle, fear,
    transformation, etc.) then generates all images in parallel using GPT-image-1 or Gemini. Returns a
    jobId for polling. Use get_campaign_results to check progress.

    Args:
        body (CreateAdCampaignBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateAdCampaignResponse200 | CreateAdCampaignResponse401 | CreateAdCampaignResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
