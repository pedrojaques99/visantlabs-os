from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.validate_brand_section_body import ValidateBrandSectionBody
from ...models.validate_brand_section_response_200 import ValidateBrandSectionResponse200
from ...models.validate_brand_section_response_401 import ValidateBrandSectionResponse401
from ...models.validate_brand_section_response_402 import ValidateBrandSectionResponse402
from ...types import Response


def _get_kwargs(
    *,
    body: ValidateBrandSectionBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/mcp/tools/validate_brand_section",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ValidateBrandSectionResponse200 | ValidateBrandSectionResponse401 | ValidateBrandSectionResponse402 | None:
    if response.status_code == 200:
        response_200 = ValidateBrandSectionResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = ValidateBrandSectionResponse401.from_dict(response.json())

        return response_401

    if response.status_code == 402:
        response_402 = ValidateBrandSectionResponse402.from_dict(response.json())

        return response_402

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[ValidateBrandSectionResponse200 | ValidateBrandSectionResponse401 | ValidateBrandSectionResponse402]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: ValidateBrandSectionBody,
) -> Response[ValidateBrandSectionResponse200 | ValidateBrandSectionResponse401 | ValidateBrandSectionResponse402]:
    """Mark a brand guideline section as approved or needs_work.

     Mark a brand guideline section as approved or needs_work. Section names: colors, typography, logos,
    identity, strategy, editorial, gradients, shadows, motion, borders, tokens.

    Args:
        body (ValidateBrandSectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ValidateBrandSectionResponse200 | ValidateBrandSectionResponse401 | ValidateBrandSectionResponse402]
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
    body: ValidateBrandSectionBody,
) -> ValidateBrandSectionResponse200 | ValidateBrandSectionResponse401 | ValidateBrandSectionResponse402 | None:
    """Mark a brand guideline section as approved or needs_work.

     Mark a brand guideline section as approved or needs_work. Section names: colors, typography, logos,
    identity, strategy, editorial, gradients, shadows, motion, borders, tokens.

    Args:
        body (ValidateBrandSectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ValidateBrandSectionResponse200 | ValidateBrandSectionResponse401 | ValidateBrandSectionResponse402
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: ValidateBrandSectionBody,
) -> Response[ValidateBrandSectionResponse200 | ValidateBrandSectionResponse401 | ValidateBrandSectionResponse402]:
    """Mark a brand guideline section as approved or needs_work.

     Mark a brand guideline section as approved or needs_work. Section names: colors, typography, logos,
    identity, strategy, editorial, gradients, shadows, motion, borders, tokens.

    Args:
        body (ValidateBrandSectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ValidateBrandSectionResponse200 | ValidateBrandSectionResponse401 | ValidateBrandSectionResponse402]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: ValidateBrandSectionBody,
) -> ValidateBrandSectionResponse200 | ValidateBrandSectionResponse401 | ValidateBrandSectionResponse402 | None:
    """Mark a brand guideline section as approved or needs_work.

     Mark a brand guideline section as approved or needs_work. Section names: colors, typography, logos,
    identity, strategy, editorial, gradients, shadows, motion, borders, tokens.

    Args:
        body (ValidateBrandSectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ValidateBrandSectionResponse200 | ValidateBrandSectionResponse401 | ValidateBrandSectionResponse402
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
