from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.post_mockups_generate_body import PostMockupsGenerateBody
from ...models.post_mockups_generate_response_200 import PostMockupsGenerateResponse200
from ...models.post_mockups_generate_response_400 import PostMockupsGenerateResponse400
from ...types import Response


def _get_kwargs(
    *,
    body: PostMockupsGenerateBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/mockups/generate",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PostMockupsGenerateResponse200 | PostMockupsGenerateResponse400 | None:
    if response.status_code == 200:
        response_200 = PostMockupsGenerateResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = PostMockupsGenerateResponse400.from_dict(response.json())

        return response_400

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[PostMockupsGenerateResponse200 | PostMockupsGenerateResponse400]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: PostMockupsGenerateBody,
) -> Response[PostMockupsGenerateResponse200 | PostMockupsGenerateResponse400]:
    """Generate mockup using AI

     Generate product mockup from image using Gemini or Claude AI

    Args:
        body (PostMockupsGenerateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostMockupsGenerateResponse200 | PostMockupsGenerateResponse400]
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
    body: PostMockupsGenerateBody,
) -> PostMockupsGenerateResponse200 | PostMockupsGenerateResponse400 | None:
    """Generate mockup using AI

     Generate product mockup from image using Gemini or Claude AI

    Args:
        body (PostMockupsGenerateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostMockupsGenerateResponse200 | PostMockupsGenerateResponse400
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PostMockupsGenerateBody,
) -> Response[PostMockupsGenerateResponse200 | PostMockupsGenerateResponse400]:
    """Generate mockup using AI

     Generate product mockup from image using Gemini or Claude AI

    Args:
        body (PostMockupsGenerateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostMockupsGenerateResponse200 | PostMockupsGenerateResponse400]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PostMockupsGenerateBody,
) -> PostMockupsGenerateResponse200 | PostMockupsGenerateResponse400 | None:
    """Generate mockup using AI

     Generate product mockup from image using Gemini or Claude AI

    Args:
        body (PostMockupsGenerateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostMockupsGenerateResponse200 | PostMockupsGenerateResponse400
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
