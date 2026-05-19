from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.batch_generate_mockups_body import BatchGenerateMockupsBody
from ...models.batch_generate_mockups_response_200 import BatchGenerateMockupsResponse200
from ...models.batch_generate_mockups_response_401 import BatchGenerateMockupsResponse401
from ...models.batch_generate_mockups_response_402 import BatchGenerateMockupsResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: BatchGenerateMockupsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/batch_generate_mockups",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> BatchGenerateMockupsResponse200 | BatchGenerateMockupsResponse401 | BatchGenerateMockupsResponse402 | None:
    if response.status_code == 200:
        response_200 = BatchGenerateMockupsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = BatchGenerateMockupsResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = BatchGenerateMockupsResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[BatchGenerateMockupsResponse200 | BatchGenerateMockupsResponse401 | BatchGenerateMockupsResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: BatchGenerateMockupsBody,
) -> Response[BatchGenerateMockupsResponse200 | BatchGenerateMockupsResponse401 | BatchGenerateMockupsResponse402]:
    """Generate multiple mockup images in parallel.

     Generate multiple mockup images in parallel. prompts can be an array of strings OR an array of
    objects { promptText, referenceImages?, baseImage? } to pass per-item reference images (e.g. brand
    logos). All items share the same model, provider, and output settings. Max 20 per call.

    Args:
        body (BatchGenerateMockupsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[BatchGenerateMockupsResponse200 | BatchGenerateMockupsResponse401 | BatchGenerateMockupsResponse402]
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
    body: BatchGenerateMockupsBody,
) -> BatchGenerateMockupsResponse200 | BatchGenerateMockupsResponse401 | BatchGenerateMockupsResponse402 | None:
    """Generate multiple mockup images in parallel.

     Generate multiple mockup images in parallel. prompts can be an array of strings OR an array of
    objects { promptText, referenceImages?, baseImage? } to pass per-item reference images (e.g. brand
    logos). All items share the same model, provider, and output settings. Max 20 per call.

    Args:
        body (BatchGenerateMockupsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        BatchGenerateMockupsResponse200 | BatchGenerateMockupsResponse401 | BatchGenerateMockupsResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: BatchGenerateMockupsBody,
) -> Response[BatchGenerateMockupsResponse200 | BatchGenerateMockupsResponse401 | BatchGenerateMockupsResponse402]:
    """Generate multiple mockup images in parallel.

     Generate multiple mockup images in parallel. prompts can be an array of strings OR an array of
    objects { promptText, referenceImages?, baseImage? } to pass per-item reference images (e.g. brand
    logos). All items share the same model, provider, and output settings. Max 20 per call.

    Args:
        body (BatchGenerateMockupsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[BatchGenerateMockupsResponse200 | BatchGenerateMockupsResponse401 | BatchGenerateMockupsResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: BatchGenerateMockupsBody,
) -> BatchGenerateMockupsResponse200 | BatchGenerateMockupsResponse401 | BatchGenerateMockupsResponse402 | None:
    """Generate multiple mockup images in parallel.

     Generate multiple mockup images in parallel. prompts can be an array of strings OR an array of
    objects { promptText, referenceImages?, baseImage? } to pass per-item reference images (e.g. brand
    logos). All items share the same model, provider, and output settings. Max 20 per call.

    Args:
        body (BatchGenerateMockupsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        BatchGenerateMockupsResponse200 | BatchGenerateMockupsResponse401 | BatchGenerateMockupsResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
