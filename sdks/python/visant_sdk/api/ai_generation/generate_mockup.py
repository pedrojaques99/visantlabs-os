from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.generate_mockup_body import GenerateMockupBody
from ...models.generate_mockup_response_200 import GenerateMockupResponse200
from ...models.generate_mockup_response_401 import GenerateMockupResponse401
from ...models.generate_mockup_response_402 import GenerateMockupResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: GenerateMockupBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/generate_mockup",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GenerateMockupResponse200 | GenerateMockupResponse401 | GenerateMockupResponse402 | None:
    if response.status_code == 200:
        response_200 = GenerateMockupResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = GenerateMockupResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = GenerateMockupResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GenerateMockupResponse200 | GenerateMockupResponse401 | GenerateMockupResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: GenerateMockupBody,
) -> Response[GenerateMockupResponse200 | GenerateMockupResponse401 | GenerateMockupResponse402]:
    """Generate a single mockup image using AI (text-to-image or image-to-image).

     Generate a single mockup image using AI (text-to-image or image-to-image). Supports gpt-image-1,
    gpt-image-2 (OpenAI), seedream, and gemini models. Returns the generated mockup object with
    imageUrl. For multiple mockups use batch_generate_mockups.

    Args:
        body (GenerateMockupBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GenerateMockupResponse200 | GenerateMockupResponse401 | GenerateMockupResponse402]
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
    body: GenerateMockupBody,
) -> GenerateMockupResponse200 | GenerateMockupResponse401 | GenerateMockupResponse402 | None:
    """Generate a single mockup image using AI (text-to-image or image-to-image).

     Generate a single mockup image using AI (text-to-image or image-to-image). Supports gpt-image-1,
    gpt-image-2 (OpenAI), seedream, and gemini models. Returns the generated mockup object with
    imageUrl. For multiple mockups use batch_generate_mockups.

    Args:
        body (GenerateMockupBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GenerateMockupResponse200 | GenerateMockupResponse401 | GenerateMockupResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: GenerateMockupBody,
) -> Response[GenerateMockupResponse200 | GenerateMockupResponse401 | GenerateMockupResponse402]:
    """Generate a single mockup image using AI (text-to-image or image-to-image).

     Generate a single mockup image using AI (text-to-image or image-to-image). Supports gpt-image-1,
    gpt-image-2 (OpenAI), seedream, and gemini models. Returns the generated mockup object with
    imageUrl. For multiple mockups use batch_generate_mockups.

    Args:
        body (GenerateMockupBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GenerateMockupResponse200 | GenerateMockupResponse401 | GenerateMockupResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: GenerateMockupBody,
) -> GenerateMockupResponse200 | GenerateMockupResponse401 | GenerateMockupResponse402 | None:
    """Generate a single mockup image using AI (text-to-image or image-to-image).

     Generate a single mockup image using AI (text-to-image or image-to-image). Supports gpt-image-1,
    gpt-image-2 (OpenAI), seedream, and gemini models. Returns the generated mockup object with
    imageUrl. For multiple mockups use batch_generate_mockups.

    Args:
        body (GenerateMockupBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GenerateMockupResponse200 | GenerateMockupResponse401 | GenerateMockupResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
