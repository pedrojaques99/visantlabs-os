from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.improve_prompt_body import ImprovePromptBody
from ...models.improve_prompt_response_200 import ImprovePromptResponse200
from ...models.improve_prompt_response_401 import ImprovePromptResponse401
from ...models.improve_prompt_response_402 import ImprovePromptResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: ImprovePromptBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/improve_prompt",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ImprovePromptResponse200 | ImprovePromptResponse401 | ImprovePromptResponse402 | None:
    if response.status_code == 200:
        response_200 = ImprovePromptResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = ImprovePromptResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = ImprovePromptResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[ImprovePromptResponse200 | ImprovePromptResponse401 | ImprovePromptResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: ImprovePromptBody,
) -> Response[ImprovePromptResponse200 | ImprovePromptResponse401 | ImprovePromptResponse402]:
    """Improve and refine an existing image generation prompt to make it more detailed and effective.

     Improve and refine an existing image generation prompt to make it more detailed and effective.

    Args:
        body (ImprovePromptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ImprovePromptResponse200 | ImprovePromptResponse401 | ImprovePromptResponse402]
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
    body: ImprovePromptBody,
) -> ImprovePromptResponse200 | ImprovePromptResponse401 | ImprovePromptResponse402 | None:
    """Improve and refine an existing image generation prompt to make it more detailed and effective.

     Improve and refine an existing image generation prompt to make it more detailed and effective.

    Args:
        body (ImprovePromptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ImprovePromptResponse200 | ImprovePromptResponse401 | ImprovePromptResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: ImprovePromptBody,
) -> Response[ImprovePromptResponse200 | ImprovePromptResponse401 | ImprovePromptResponse402]:
    """Improve and refine an existing image generation prompt to make it more detailed and effective.

     Improve and refine an existing image generation prompt to make it more detailed and effective.

    Args:
        body (ImprovePromptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ImprovePromptResponse200 | ImprovePromptResponse401 | ImprovePromptResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: ImprovePromptBody,
) -> ImprovePromptResponse200 | ImprovePromptResponse401 | ImprovePromptResponse402 | None:
    """Improve and refine an existing image generation prompt to make it more detailed and effective.

     Improve and refine an existing image generation prompt to make it more detailed and effective.

    Args:
        body (ImprovePromptBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ImprovePromptResponse200 | ImprovePromptResponse401 | ImprovePromptResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
