from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.post_branding_generate_step_body import PostBrandingGenerateStepBody
from ...models.post_branding_generate_step_response_200 import PostBrandingGenerateStepResponse200
from ...models.post_branding_generate_step_response_402 import PostBrandingGenerateStepResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: PostBrandingGenerateStepBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/branding/generate-step",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PostBrandingGenerateStepResponse200 | PostBrandingGenerateStepResponse402 | None:
    if response.status_code == 200:
        response_200 = PostBrandingGenerateStepResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 402:
        response_402 = PostBrandingGenerateStepResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[PostBrandingGenerateStepResponse200 | PostBrandingGenerateStepResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: PostBrandingGenerateStepBody,
) -> Response[PostBrandingGenerateStepResponse200 | PostBrandingGenerateStepResponse402]:
    """Generate a branding step (persona, archetype, SWOT, colors, moodboard, etc.)

     Multi-step branding generation engine. Each step generates a specific brand asset using AI.
    Step values:
    - 1: Market Research — benchmarking paragraph
    - 5: Competitors — competitive landscape
    - 6: References — visual design inspirations
    - 7: SWOT — strengths/weaknesses/opportunities/threats
    - 8: Color Palettes — AI color recommendations with hex codes
    - 9: Visual Elements — icons, patterns, textures
    - 10: Persona — audience persona (demographics, psychographics, pain points)
    - 11: Concept Ideas — product mockup and usage scenarios
    - 12: Moodboard — mood and aesthetic direction
    - 13: Archetypes — brand archetype analysis (Hero, Sage, Lover, Caregiver, etc.)

    Args:
        body (PostBrandingGenerateStepBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostBrandingGenerateStepResponse200 | PostBrandingGenerateStepResponse402]
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
    body: PostBrandingGenerateStepBody,
) -> PostBrandingGenerateStepResponse200 | PostBrandingGenerateStepResponse402 | None:
    """Generate a branding step (persona, archetype, SWOT, colors, moodboard, etc.)

     Multi-step branding generation engine. Each step generates a specific brand asset using AI.
    Step values:
    - 1: Market Research — benchmarking paragraph
    - 5: Competitors — competitive landscape
    - 6: References — visual design inspirations
    - 7: SWOT — strengths/weaknesses/opportunities/threats
    - 8: Color Palettes — AI color recommendations with hex codes
    - 9: Visual Elements — icons, patterns, textures
    - 10: Persona — audience persona (demographics, psychographics, pain points)
    - 11: Concept Ideas — product mockup and usage scenarios
    - 12: Moodboard — mood and aesthetic direction
    - 13: Archetypes — brand archetype analysis (Hero, Sage, Lover, Caregiver, etc.)

    Args:
        body (PostBrandingGenerateStepBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostBrandingGenerateStepResponse200 | PostBrandingGenerateStepResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostBrandingGenerateStepBody,
) -> Response[PostBrandingGenerateStepResponse200 | PostBrandingGenerateStepResponse402]:
    """Generate a branding step (persona, archetype, SWOT, colors, moodboard, etc.)

     Multi-step branding generation engine. Each step generates a specific brand asset using AI.
    Step values:
    - 1: Market Research — benchmarking paragraph
    - 5: Competitors — competitive landscape
    - 6: References — visual design inspirations
    - 7: SWOT — strengths/weaknesses/opportunities/threats
    - 8: Color Palettes — AI color recommendations with hex codes
    - 9: Visual Elements — icons, patterns, textures
    - 10: Persona — audience persona (demographics, psychographics, pain points)
    - 11: Concept Ideas — product mockup and usage scenarios
    - 12: Moodboard — mood and aesthetic direction
    - 13: Archetypes — brand archetype analysis (Hero, Sage, Lover, Caregiver, etc.)

    Args:
        body (PostBrandingGenerateStepBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostBrandingGenerateStepResponse200 | PostBrandingGenerateStepResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostBrandingGenerateStepBody,
) -> PostBrandingGenerateStepResponse200 | PostBrandingGenerateStepResponse402 | None:
    """Generate a branding step (persona, archetype, SWOT, colors, moodboard, etc.)

     Multi-step branding generation engine. Each step generates a specific brand asset using AI.
    Step values:
    - 1: Market Research — benchmarking paragraph
    - 5: Competitors — competitive landscape
    - 6: References — visual design inspirations
    - 7: SWOT — strengths/weaknesses/opportunities/threats
    - 8: Color Palettes — AI color recommendations with hex codes
    - 9: Visual Elements — icons, patterns, textures
    - 10: Persona — audience persona (demographics, psychographics, pain points)
    - 11: Concept Ideas — product mockup and usage scenarios
    - 12: Moodboard — mood and aesthetic direction
    - 13: Archetypes — brand archetype analysis (Hero, Sage, Lover, Caregiver, etc.)

    Args:
        body (PostBrandingGenerateStepBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostBrandingGenerateStepResponse200 | PostBrandingGenerateStepResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
