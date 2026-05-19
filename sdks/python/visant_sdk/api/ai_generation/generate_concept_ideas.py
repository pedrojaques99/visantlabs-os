from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.generate_concept_ideas_body import GenerateConceptIdeasBody
from ...models.generate_concept_ideas_response_200 import GenerateConceptIdeasResponse200
from ...models.generate_concept_ideas_response_401 import GenerateConceptIdeasResponse401
from ...models.generate_concept_ideas_response_402 import GenerateConceptIdeasResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: GenerateConceptIdeasBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/generate_concept_ideas",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GenerateConceptIdeasResponse200 | GenerateConceptIdeasResponse401 | GenerateConceptIdeasResponse402 | None:
    if response.status_code == 200:
        response_200 = GenerateConceptIdeasResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = GenerateConceptIdeasResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = GenerateConceptIdeasResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GenerateConceptIdeasResponse200 | GenerateConceptIdeasResponse401 | GenerateConceptIdeasResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: GenerateConceptIdeasBody,
) -> Response[GenerateConceptIdeasResponse200 | GenerateConceptIdeasResponse401 | GenerateConceptIdeasResponse402]:
    """Generate creative mockup/usage scenario ideas for a product or brand.

     Generate creative mockup/usage scenario ideas for a product or brand.

    Args:
        body (GenerateConceptIdeasBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GenerateConceptIdeasResponse200 | GenerateConceptIdeasResponse401 | GenerateConceptIdeasResponse402]
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
    body: GenerateConceptIdeasBody,
) -> GenerateConceptIdeasResponse200 | GenerateConceptIdeasResponse401 | GenerateConceptIdeasResponse402 | None:
    """Generate creative mockup/usage scenario ideas for a product or brand.

     Generate creative mockup/usage scenario ideas for a product or brand.

    Args:
        body (GenerateConceptIdeasBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GenerateConceptIdeasResponse200 | GenerateConceptIdeasResponse401 | GenerateConceptIdeasResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: GenerateConceptIdeasBody,
) -> Response[GenerateConceptIdeasResponse200 | GenerateConceptIdeasResponse401 | GenerateConceptIdeasResponse402]:
    """Generate creative mockup/usage scenario ideas for a product or brand.

     Generate creative mockup/usage scenario ideas for a product or brand.

    Args:
        body (GenerateConceptIdeasBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GenerateConceptIdeasResponse200 | GenerateConceptIdeasResponse401 | GenerateConceptIdeasResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: GenerateConceptIdeasBody,
) -> GenerateConceptIdeasResponse200 | GenerateConceptIdeasResponse401 | GenerateConceptIdeasResponse402 | None:
    """Generate creative mockup/usage scenario ideas for a product or brand.

     Generate creative mockup/usage scenario ideas for a product or brand.

    Args:
        body (GenerateConceptIdeasBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GenerateConceptIdeasResponse200 | GenerateConceptIdeasResponse401 | GenerateConceptIdeasResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
