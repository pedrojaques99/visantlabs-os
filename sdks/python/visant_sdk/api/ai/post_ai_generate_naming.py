from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.post_ai_generate_naming_body import PostAiGenerateNamingBody
from ...models.post_ai_generate_naming_response_200 import PostAiGenerateNamingResponse200
from ...types import Response


def _get_kwargs(
    *,
    body: PostAiGenerateNamingBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/ai/generate-naming",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PostAiGenerateNamingResponse200 | None:
    if response.status_code == 200:
        response_200 = PostAiGenerateNamingResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[PostAiGenerateNamingResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: PostAiGenerateNamingBody,
) -> Response[PostAiGenerateNamingResponse200]:
    """Generate brand or product name suggestions

     Generate creative and memorable name suggestions from a brief. Optionally biased by a brand
    guideline.

    Args:
        body (PostAiGenerateNamingBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostAiGenerateNamingResponse200]
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
    body: PostAiGenerateNamingBody,
) -> PostAiGenerateNamingResponse200 | None:
    """Generate brand or product name suggestions

     Generate creative and memorable name suggestions from a brief. Optionally biased by a brand
    guideline.

    Args:
        body (PostAiGenerateNamingBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostAiGenerateNamingResponse200
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostAiGenerateNamingBody,
) -> Response[PostAiGenerateNamingResponse200]:
    """Generate brand or product name suggestions

     Generate creative and memorable name suggestions from a brief. Optionally biased by a brand
    guideline.

    Args:
        body (PostAiGenerateNamingBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostAiGenerateNamingResponse200]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostAiGenerateNamingBody,
) -> PostAiGenerateNamingResponse200 | None:
    """Generate brand or product name suggestions

     Generate creative and memorable name suggestions from a brief. Optionally biased by a brand
    guideline.

    Args:
        body (PostAiGenerateNamingBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostAiGenerateNamingResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
