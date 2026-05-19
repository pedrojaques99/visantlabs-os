from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.post_ai_generate_smart_prompt_body import PostAiGenerateSmartPromptBody
from ...models.post_ai_generate_smart_prompt_response_200 import PostAiGenerateSmartPromptResponse200
from ...types import Response


def _get_kwargs(
    *,
    body: PostAiGenerateSmartPromptBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/ai/generate-smart-prompt",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PostAiGenerateSmartPromptResponse200 | None:
    if response.status_code == 200:
        response_200 = PostAiGenerateSmartPromptResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[PostAiGenerateSmartPromptResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: PostAiGenerateSmartPromptBody,
) -> Response[PostAiGenerateSmartPromptResponse200]:
    """Generate an optimized image prompt from structured inputs

     Build a high-quality image generation prompt from design type, style tags, colors, and optional
    brand context.

    Args:
        body (PostAiGenerateSmartPromptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostAiGenerateSmartPromptResponse200]
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
    body: PostAiGenerateSmartPromptBody,
) -> PostAiGenerateSmartPromptResponse200 | None:
    """Generate an optimized image prompt from structured inputs

     Build a high-quality image generation prompt from design type, style tags, colors, and optional
    brand context.

    Args:
        body (PostAiGenerateSmartPromptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostAiGenerateSmartPromptResponse200
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostAiGenerateSmartPromptBody,
) -> Response[PostAiGenerateSmartPromptResponse200]:
    """Generate an optimized image prompt from structured inputs

     Build a high-quality image generation prompt from design type, style tags, colors, and optional
    brand context.

    Args:
        body (PostAiGenerateSmartPromptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostAiGenerateSmartPromptResponse200]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostAiGenerateSmartPromptBody,
) -> PostAiGenerateSmartPromptResponse200 | None:
    """Generate an optimized image prompt from structured inputs

     Build a high-quality image generation prompt from design type, style tags, colors, and optional
    brand context.

    Args:
        body (PostAiGenerateSmartPromptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostAiGenerateSmartPromptResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
