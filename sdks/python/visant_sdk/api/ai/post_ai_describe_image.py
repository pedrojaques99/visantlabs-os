from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.post_ai_describe_image_body import PostAiDescribeImageBody
from ...models.post_ai_describe_image_response_200 import PostAiDescribeImageResponse200
from ...types import Response


def _get_kwargs(
    *,
    body: PostAiDescribeImageBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/ai/describe-image",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PostAiDescribeImageResponse200 | None:
    if response.status_code == 200:
        response_200 = PostAiDescribeImageResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[PostAiDescribeImageResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: PostAiDescribeImageBody,
) -> Response[PostAiDescribeImageResponse200]:
    """Describe / extract prompt from an image

     Analyze an image and return a detailed description suitable for use as a generation prompt.

    Args:
        body (PostAiDescribeImageBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostAiDescribeImageResponse200]
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
    body: PostAiDescribeImageBody,
) -> PostAiDescribeImageResponse200 | None:
    """Describe / extract prompt from an image

     Analyze an image and return a detailed description suitable for use as a generation prompt.

    Args:
        body (PostAiDescribeImageBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostAiDescribeImageResponse200
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostAiDescribeImageBody,
) -> Response[PostAiDescribeImageResponse200]:
    """Describe / extract prompt from an image

     Analyze an image and return a detailed description suitable for use as a generation prompt.

    Args:
        body (PostAiDescribeImageBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostAiDescribeImageResponse200]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostAiDescribeImageBody,
) -> PostAiDescribeImageResponse200 | None:
    """Describe / extract prompt from an image

     Analyze an image and return a detailed description suitable for use as a generation prompt.

    Args:
        body (PostAiDescribeImageBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostAiDescribeImageResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
