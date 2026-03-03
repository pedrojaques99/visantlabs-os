[Skip to main content](https://developers.figma.com/docs/rest-api/component-endpoints/#__docusaurus_skipToContent_fallback)

[**Developers**](https://developers.figma.com/)

Dev Mode

Code in Figma

Extensions

Integrations

[Compare APIs](https://developers.figma.com/compare-apis/)

[My Apps](https://www.figma.com/developers/apps)

Search`` `K`

- REST API

  - [Introduction](https://developers.figma.com/docs/rest-api/)
  - [Authentication](https://developers.figma.com/docs/rest-api/authentication/)
  - [Scopes](https://developers.figma.com/docs/rest-api/scopes/)
  - [Rate Limits](https://developers.figma.com/docs/rest-api/rate-limits/)
  - [Figma files](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Comments](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Users](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Version history](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Projects](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Components](https://developers.figma.com/docs/rest-api/component-endpoints/#)

    - [Types](https://developers.figma.com/docs/rest-api/component-types/)
    - [Endpoints](https://developers.figma.com/docs/rest-api/component-endpoints/)
  - [Webhooks](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Activity logs](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Discovery](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Payments](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Variables](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Dev Resources](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Library Analytics](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Errors](https://developers.figma.com/docs/rest-api/errors/)
  - [SCIM API Reference](https://developers.figma.com/docs/rest-api/component-endpoints/#)

  - [Changelog](https://developers.figma.com/docs/rest-api/changelog/)

- [Home page](https://developers.figma.com/)
- REST API
- Components
- Endpoints

On this page

# Endpoints

Components and styles endpoints allow several ways to get information about published components and styles in a team library. You can get a list of components or styles using a team\_id, or a specific component or style using a key.

## GET team components [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#get-team-components-endpoint "Direct link to GET team components")

Get a paginated list of published components within a team library.

info

This is a [Tier 3 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`team_library_content:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP Endpoint [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#http-endpoint "Direct link to HTTP Endpoint")

`GET /v1/teams/:team_id/components`

**Return value**

```json
{
  "status": Number,
  "error": Boolean,
  "meta": {
    "components": [\
      {\
       "key": String,\
       "file_key": String,\
       "node_id": String,\
       "thumbnail_url": String,\
       "name": String,\
       "description": String,\
       "updated_at": String,\
       "created_at": String,\
       "user": User,\
       "containing_frame": FrameInfo,\
      },\
      ...\
    ],
    "cursor": {
      "before": Number,
      "after": Number,
    },
   },
}
```

| Path parameters | Description |
| --- | --- |
| team\_id | StringID of the team to list components from. |

| Query parameters | Description |
| --- | --- |
| page\_size | Numberdefault: 30Number of items in a paged list of results. Maximum of 1000. |
| after | NumberCursor indicating which id after which to start retrieving components for. Exclusive with before. The cursor value is an internally tracked integer that doesn't correspond to any Ids. |
| before | NumberCursor indicating which id before which to start retrieving components for. Exclusive with after. The cursor value is an internally tracked integer that doesn't correspond to any Ids. |

| Error codes | Description |
| --- | --- |
| 400 | Error with the request. The `message` param on the response will describe the error. |
| 403 | Insufficient permission on the team. This could also indicate the developer / OAuth token is invalid or expired. |
| 404 | Requested resource was not found. |

## GET file components [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#get-file-components-endpoint "Direct link to GET file components")

Get a list of published components within a file library.

info

This is a [Tier 3 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`library_content:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP Endpoint [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#http-endpoint-1 "Direct link to HTTP Endpoint")

`GET /v1/files/:file_key/components`

**Return value**

```json
{
  "status": Number,
  "error": Boolean,
  "meta": {
    "components": [\
      {\
       "key": String,\
       "file_key": String,\
       "node_id": String,\
       "thumbnail_url": String,\
       "name": String,\
       "description": String,\
       "updated_at": String,\
       "created_at": String,\
       "user": User,\
       "containing_frame": FrameInfo,\
      },\
      ...\
    ],
   },
}
```

| Path parameters | Description |
| --- | --- |
| file\_key | StringFile to list components from. This must be a main file key, not a branch key, as it is not possible to publish from branches. |

| Error codes | Description |
| --- | --- |
| 400 | Error with the request. The `message` param on the response will describe the error. |
| 403 | Insufficient permission on the team. This could also indicate the developer / OAuth token is invalid or expired. |
| 404 | Requested resource was not found. |

## GET component [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#get-component-endpoint "Direct link to GET component")

Get metadata on a component by key.

info

This is a [Tier 3 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`library_assets:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP Endpoint [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#http-endpoint-2 "Direct link to HTTP Endpoint")

`GET /v1/components/:key`

**Return value**

```json
{
  "status": Number,
  "error": Boolean,
  "meta": {
     "key": String,
     "file_key": String,
     "node_id": String,
     "thumbnail_url": String,
     "name": String,
     "description": String,
     "updated_at": String,
     "created_at": String,
     "user": User,
     "containing_frame": FrameInfo,
   },
}
```

| Path parameters | Description |
| --- | --- |
| key | StringThe unique identifier of the component. |

| Error codes | Description |
| --- | --- |
| 400 | Error with the request. The `message` param on the response will describe the error. |
| 403 | Insufficient permission on the team. This could also indicate the developer / OAuth token is invalid or expired. |
| 404 | Requested resource was not found. |

## GET team component sets [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#get-team-component-sets-endpoint "Direct link to GET team component sets")

Get a paginated list of published component sets within a team library.

info

This is a [Tier 3 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`team_library_content:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP Endpoint [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#http-endpoint-3 "Direct link to HTTP Endpoint")

`GET /v1/teams/:team_id/component_sets`

**Return value**

```json
{
  "status": Number,
  "error": Boolean,
  "meta": {
    "component_sets": [\
      {\
       "key": String,\
       "file_key": String,\
       "node_id": String,\
       "thumbnail_url": String,\
       "name": String,\
       "description": String,\
       "updated_at": String,\
       "created_at": String,\
       "user": User,\
       "containing_frame": FrameInfo,\
      },\
      ...\
    ],
    "cursor": {
      "before": Number,
      "after": Number,
    },
   },
}
```

| Path parameters | Description |
| --- | --- |
| team\_id | StringID of the team to list component sets from. |

| Query parameters | Description |
| --- | --- |
| page\_size | Numberdefault: 30Number of items in a paged list of results. |
| after | NumberCursor indicating which id after which to start retrieving components for. Exclusive with before. The cursor value is an internally tracked integer that doesn't correspond to any Ids. |
| before | NumberCursor indicating which id before which to start retrieving components for. Exclusive with after. The cursor value is an internally tracked integer that doesn't correspond to any Ids. |

| Error codes | Description |
| --- | --- |
| 400 | Error with the request. The `message` param on the response will describe the error. |
| 403 | Insufficient permission on the team. This could also indicate the developer / OAuth token is invalid or expired. |
| 404 | Requested resource was not found. |

## GET file component sets [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#get-file-component-sets-endpoint "Direct link to GET file component sets")

Get a list of published component sets within a file library.

info

This is a [Tier 3 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`library_content:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP Endpoint [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#http-endpoint-4 "Direct link to HTTP Endpoint")

`GET /v1/files/:file_key/component_sets`

**Return value**

```json
{
  "status": Number,
  "error": Boolean,
  "meta": {
    "component_sets": [\
      {\
       "key": String,\
       "file_key": String,\
       "node_id": String,\
       "thumbnail_url": String,\
       "name": String,\
       "description": String,\
       "updated_at": String,\
       "created_at": String,\
       "user": User,\
       "containing_frame": FrameInfo,\
      },\
      ...\
    ],
   },
}
```

| Path parameters | Description |
| --- | --- |
| file\_key | StringFile to list component sets from. This must be a main file key, not a branch key, as it is not possible to publish from branches. |

| Error codes | Description |
| --- | --- |
| 400 | Error with the request. The `message` param on the response will describe the error. |
| 403 | Insufficient permission on the team. This could also indicate the developer / OAuth token is invalid or expired. |
| 404 | Requested resource was not found. |

## GET component set [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#get-component-set-endpoint "Direct link to GET component set")

Get metadata on a component set by key.

info

This is a [Tier 3 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`library_assets:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP Endpoint [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#http-endpoint-5 "Direct link to HTTP Endpoint")

`GET /v1/component_sets/:key`

**Return value**

```json
{
  "status": Number,
  "error": Boolean,
  "meta": {
     "key": String,
     "file_key": String,
     "node_id": String,
     "thumbnail_url": String,
     "name": String,
     "description": String,
     "updated_at": String,
     "created_at": String,
     "user": User,
     "containing_frame": FrameInfo,
   },
}
```

| Path parameters | Description |
| --- | --- |
| key | StringThe unique identifier of the component set. |

| Error codes | Description |
| --- | --- |
| 400 | Error with the request. The `message` param on the response will describe the error. |
| 403 | Insufficient permission on the team. This could also indicate the developer / OAuth token is invalid or expired. |
| 404 | Requested resource was not found. |

## GET team styles [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#get-team-styles-endpoint "Direct link to GET team styles")

Get a paginated list of published styles within a team library.

info

This is a [Tier 3 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`team_library_content:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP Endpoint [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#http-endpoint-6 "Direct link to HTTP Endpoint")

`GET /v1/teams/:team_id/styles`

**Return value**

```json
{
  "status": Number,
  "error": Boolean,
  "meta": {
    "styles": [\
      {\
       "key": String,\
       "file_key": String,\
       "node_id": String,\
       "style_type": StyleType,\
       "thumbnail_url": String,\
       "name": String,\
       "description": String,\
       "updated_at": String,\
       "created_at": String,\
       "sort_position": String,\
       "user": User,\
       },\
      ...\
    ],
    "cursor": {
      "before": Number,
      "after": Number,
    },
   },
}
```

| Path parameters | Description |
| --- | --- |
| team\_id | StringID of the team to list styles from. |

| Query parameters | Description |
| --- | --- |
| page\_size | Numberdefault: 30Number of items in a paged list of results. |
| after | NumberCursor indicating which id after which to start retrieving styles for. Exclusive with before. The cursor value is an internally tracked integer that doesn't correspond to any Ids. |
| before | NumberCursor indicating which id before which to start retrieving styles for. Exclusive with after. The cursor value is an internally tracked integer that doesn't correspond to any Ids. |

| Error codes | Description |
| --- | --- |
| 400 | Error with the request. The `message` param on the response will describe the error. |
| 403 | Insufficient permission on the team. This could also indicate the developer / OAuth token is invalid or expired. |
| 404 | Requested resource was not found. |

## GET file styles [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#get-file-styles-endpoint "Direct link to GET file styles")

Get a list of published styles within a file library.

info

This is a [Tier 3 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`library_content:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP Endpoint [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#http-endpoint-7 "Direct link to HTTP Endpoint")

`GET /v1/files/:file_key/styles`

**Return value**

```json
{
  "status": Number,
  "error": Boolean,
  "meta": {
    "styles": [\
      {\
       "key": String,\
       "file_key": String,\
       "node_id": String,\
       "style_type": StyleType,\
       "thumbnail_url": String,\
       "name": String,\
       "description": String,\
       "updated_at": String,\
       "created_at": String,\
       "sort_position": String,\
       "user": User,\
       },\
      ...\
    ],
   },
}
```

| Path parameters | Description |
| --- | --- |
| file\_key | StringFile to list styles from. This must be a main file key, not a branch key, as it is not possible to publish from branches. |

| Error codes | Description |
| --- | --- |
| 400 | Error with the request. The `message` param on the response will describe the error. |
| 403 | Insufficient permission on the team. This could also indicate the developer / OAuth token is invalid or expired. |
| 404 | Requested resource was not found. |

## GET style [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#get-style-endpoint "Direct link to GET style")

Get metadata on a style by key.

info

This is a [Tier 3 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`library_assets:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP Endpoint [​](https://developers.figma.com/docs/rest-api/component-endpoints/\#http-endpoint-8 "Direct link to HTTP Endpoint")

`GET /v1/styles/:key`

**Return value**

```json
{
  "status": Number,
  "error": Boolean,
  "meta": {
     "key": String,
     "file_key": String,
     "node_id": String,
     "style_type": StyleType,
     "thumbnail_url": String,
     "name": String,
     "description": String,
     "updated_at": String,
     "created_at": String,
     "sort_position": String,
     "user": User,
   },
}
```

| Path parameters | Description |
| --- | --- |
| key | StringThe unique identifier of the style. |

| Error codes | Description |
| --- | --- |
| 400 | Error with the request. The `message` param on the response will describe the error. |
| 403 | Insufficient permission on the team. This could also indicate the developer / OAuth token is invalid or expired. |
| 404 | Requested resource was not found. |

[Previous\\
\\
Types](https://developers.figma.com/docs/rest-api/component-types/)

- [GET team components](https://developers.figma.com/docs/rest-api/component-endpoints/#get-team-components-endpoint)
- [GET file components](https://developers.figma.com/docs/rest-api/component-endpoints/#get-file-components-endpoint)
- [GET component](https://developers.figma.com/docs/rest-api/component-endpoints/#get-component-endpoint)
- [GET team component sets](https://developers.figma.com/docs/rest-api/component-endpoints/#get-team-component-sets-endpoint)
- [GET file component sets](https://developers.figma.com/docs/rest-api/component-endpoints/#get-file-component-sets-endpoint)
- [GET component set](https://developers.figma.com/docs/rest-api/component-endpoints/#get-component-set-endpoint)
- [GET team styles](https://developers.figma.com/docs/rest-api/component-endpoints/#get-team-styles-endpoint)
- [GET file styles](https://developers.figma.com/docs/rest-api/component-endpoints/#get-file-styles-endpoint)
- [GET style](https://developers.figma.com/docs/rest-api/component-endpoints/#get-style-endpoint)

Was this page helpful?

[Leave us feedback](https://form.asana.com/?k=6r2Tos6p01DyVKGLeYJByg&d=10497086658021)

* * *

- [Community Forum](https://forum.figma.com/)
- [Discord Server](https://discord.gg/xzQhe2Vcvx)
- [GitHub Samples](https://github.com/figma/widget-samples)

[FigJam](https://www.figma.com/figjam/)· [Enterprise](https://www.figma.com/enterprise/)· [Learn](https://help.figma.com/)· [Education](https://www.figma.com/education/)· [Careers](https://www.figma.com/careers/)· [Pricing](https://www.figma.com/pricing/)· [Developers](https://www.figma.com/developers)· [Blog](https://www.figma.com/blog/)· [Downloads](https://www.figma.com/downloads/)· [Releases](https://www.figma.com/release-notes/)· [Security](https://www.figma.com/security/)· [Legal](https://www.figma.com/legal)· [Contact](https://www.figma.com/contact/)