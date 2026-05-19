from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.suggest_prompt_variations_body import SuggestPromptVariationsBody
from ...models.suggest_prompt_variations_response_200 import SuggestPromptVariationsResponse200
from ...models.suggest_prompt_variations_response_401 import SuggestPromptVariationsResponse401
from ...models.suggest_prompt_variations_response_402 import SuggestPromptVariationsResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: SuggestPromptVariationsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/suggest_prompt_variations",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    SuggestPromptVariationsResponse200 | SuggestPromptVariationsResponse401 | SuggestPromptVariationsResponse402 | None
):
    if response.status_code == 200:
        response_200 = SuggestPromptVariationsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = SuggestPromptVariationsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = SuggestPromptVariationsResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[
    SuggestPromptVariationsResponse200 | SuggestPromptVariationsResponse401 | SuggestPromptVariationsResponse402
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: SuggestPromptVariationsBody,
) -> Response[
    SuggestPromptVariationsResponse200 | SuggestPromptVariationsResponse401 | SuggestPromptVariationsResponse402
]:
    """Generate multiple creative variations of an existing prompt.

     Generate multiple creative variations of an existing prompt.

    Args:
        body (SuggestPromptVariationsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[SuggestPromptVariationsResponse200 | SuggestPromptVariationsResponse401 | SuggestPromptVariationsResponse402]
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
    body: SuggestPromptVariationsBody,
) -> (
    SuggestPromptVariationsResponse200 | SuggestPromptVariationsResponse401 | SuggestPromptVariationsResponse402 | None
):
    """Generate multiple creative variations of an existing prompt.

     Generate multiple creative variations of an existing prompt.

    Args:
        body (SuggestPromptVariationsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        SuggestPromptVariationsResponse200 | SuggestPromptVariationsResponse401 | SuggestPromptVariationsResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: SuggestPromptVariationsBody,
) -> Response[
    SuggestPromptVariationsResponse200 | SuggestPromptVariationsResponse401 | SuggestPromptVariationsResponse402
]:
    """Generate multiple creative variations of an existing prompt.

     Generate multiple creative variations of an existing prompt.

    Args:
        body (SuggestPromptVariationsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[SuggestPromptVariationsResponse200 | SuggestPromptVariationsResponse401 | SuggestPromptVariationsResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: SuggestPromptVariationsBody,
) -> (
    SuggestPromptVariationsResponse200 | SuggestPromptVariationsResponse401 | SuggestPromptVariationsResponse402 | None
):
    """Generate multiple creative variations of an existing prompt.

     Generate multiple creative variations of an existing prompt.

    Args:
        body (SuggestPromptVariationsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        SuggestPromptVariationsResponse200 | SuggestPromptVariationsResponse401 | SuggestPromptVariationsResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
