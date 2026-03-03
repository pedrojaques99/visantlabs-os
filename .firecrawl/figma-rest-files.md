[Skip to main content](https://developers.figma.com/docs/rest-api/file-endpoints/#__docusaurus_skipToContent_fallback)

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
  - [Figma files](https://developers.figma.com/docs/rest-api/file-endpoints/#)

    - [Global properties](https://developers.figma.com/docs/rest-api/files/)
    - [Node types](https://developers.figma.com/docs/rest-api/file-node-types/)
    - [Property types](https://developers.figma.com/docs/rest-api/file-property-types/)
    - [Endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/)
  - [Comments](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Users](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Version history](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Projects](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Components](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Webhooks](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Activity logs](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Discovery](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Payments](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Variables](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Dev Resources](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Library Analytics](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Errors](https://developers.figma.com/docs/rest-api/errors/)
  - [SCIM API Reference](https://developers.figma.com/docs/rest-api/file-endpoints/#)

  - [Changelog](https://developers.figma.com/docs/rest-api/changelog/)

- [Home page](https://developers.figma.com/)
- REST API
- Figma files
- Endpoints

On this page

# Endpoints

Files endpoints allow for a wide range of functionality to get information about files. With a specific file key, you can get the JSON and image representations of the whole file or individual nodes within the file.

## GET file [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#get-files-endpoint "Direct link to GET file")

Returns the document referred to by `:key` as a JSON object. The file key can be parsed from any Figma file url: `https://www.figma.com/:file_type/:file_key/:file_name`. The `name`, `lastModified`, `thumbnailUrl`, `editorType`, `linkAccess`, and `version` attributes are all metadata of the retrieved file. The `document` attribute contains a Node of type [DOCUMENT](https://developers.figma.com/docs/rest-api/file-node-types/#document-props).

The `components` key contains a mapping from node IDs to component metadata. This is to help you determine which components each instance comes from.

info

This is a [Tier 1 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`file_content:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP endpoint [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#http-endpoint "Direct link to HTTP endpoint")

`GET /v1/files/:key`

**Return value**

```json
{
  "name": String,
  "role": String,
  "lastModified": String,
  "editorType": String,
  "thumbnailUrl": String,
  "version": String,
  "document": Node,
  "components": Map<String, Component>,
  "componentSets": Map<String, ComponentSet>,
  "schemaVersion": 0,
  "styles": Map<String, Style>
  "mainFileKey": String,
  "branches": [\
    {\
    "key": String,\
    "name": String,\
    "thumbnail_url": String,\
    "last_modified": String,\
    "link_access": String,\
    }\
  ]
}
```

| Path parameters | Description |
| --- | --- |
| key | StringFile to export JSON from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key. |

| Query parameters | Description |
| --- | --- |
| version | StringoptionalA specific version ID to get. Omitting this will get the current version of the file. |
| ids | Stringoptional<br>Comma separated list of nodes that you care about in the document. If specified, only a subset of the document will be returned corresponding to the nodes listed, their children, and everything between the root node and the listed nodes.<br>Note: There may be other nodes included in the returned JSON that are outside the ancestor chains of the desired nodes. The response may also include dependencies of anything in the nodes' subtrees. For example, if a node subtree contains an instance of a local component that lives elsewhere in that file, that component and its ancestor chain will also be included.<br>For historical reasons, top-level canvas nodes are always returned, regardless of whether they are listed in the `ids` parameter. This quirk may be removed in a future version of the API. |
| depth | NumberoptionalPositive integer representing how deep into the document tree to traverse. For example, setting this to 1 returns only Pages, setting it to 2 returns Pages and all top level objects on each page. Not setting this parameter returns all nodes. |
| geometry | StringoptionalSet to `paths` to export vector data. |
| plugin\_data | StringoptionalA comma separated list of plugin IDs and/or the string `shared`. Any data present in the document written by those plugins will be included in the result in the `pluginData` and `sharedPluginData` properties. |
| branch\_data | Booleanoptionaldefault: falseReturns branch metadata for the requested file. If the file is a branch, the main file's key will be included in the returned response. If the file has branches, their metadata will be included in the returned response. |

| Error codes | Description |
| --- | --- |
| 403 | The developer / OAuth token is invalid or expired |
| 404 | The specified file was not found |

### Examples [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#examples "Direct link to Examples")

To get the JSON for specific nodes, their subtrees, and all the nodes in their ancestor chains:

```text
GET /v1/files/:key?ids=1:2,1:3
```

To get the JSON for the document tree stopping at the top-level nodes on each page (all pages live at depth 1):

```text
GET /v1/files/:key?depth=2
```

## GET file nodes [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#get-file-nodes-endpoint "Direct link to GET file nodes")

Returns the nodes referenced to by `:ids` as a JSON object. The nodes are retrieved from the Figma file referenced to by `:key`.

The node id and file key can be parsed from any Figma node url: `https://www.figma.com/:file_type/:file_key/:file_name?node-id=:id`.

The name, lastModified, thumbnailUrl, editorType, and version attributes are all metadata of the specified file.

The `linkAccess` field describes the file link share permission level. There are 5 types of permissions a shared link can have: `inherit`, `view`, `edit`, `org_view`, and `org_edit`. `inherit` is the default permission applied to files created in a team project, and will inherit the project's permissions. `org_view` and `org_edit` restrict the link to org users.

The `document` attribute contains a Node of type [DOCUMENT](https://developers.figma.com/docs/rest-api/file-node-types/#document-props).

The components key contains a mapping from node IDs to component metadata. This is to help you determine which components each instance comes from.

By default, no vector data is returned. To return vector data, pass the `geometry=paths` parameter to the endpoint.
Each node can also inherit properties from applicable styles. The `styles` key contains a mapping from style IDs to style metadata.

warning

**Important:** the nodes map may contain values that are null . This may be due to the node id not existing within the specified file.

info

This is a [Tier 1 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`file_content:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP endpoint [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#http-endpoint-1 "Direct link to HTTP endpoint")

`GET /v1/files/:key/nodes`

**Return value**

```json
{
  "name": String,
  "role": String,
  "lastModified": String,
  "editorType": String,
  "thumbnailUrl": String,
  "err": String,
  "nodes": {
    "id": {
      "document": Node,
      "components": Map<String, Component>,
      "componentSets": Map<String, ComponentSet>,
      "schemaVersion": 0,
      "styles": Map<String, Style>
       ...
    }
  }
}
```

| Path parameters | Description |
| --- | --- |
| key | StringFile to export JSON from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key. |

| Query parameters | Description |
| --- | --- |
| ids | StringA comma separated list of node IDs to retrieve and convert. |
| version | StringoptionalA specific version ID to get. Omitting this will get the current version of the file. |
| depth | NumberoptionalPositive integer representing how deep into the node tree to traverse. For example, setting this to 1 will return only the children directly underneath the desired nodes. Not setting this parameter returns all nodes. |
| geometry | StringoptionalSet to `paths` to export vector data. |
| plugin\_data | StringoptionalA comma separated list of plugin IDs and/or the string `shared`. Any data present in the document written by those plugins will be included in the result in the `pluginData` and `sharedPluginData` properties. |

| Error codes | Description |
| --- | --- |
| 400 | Invalid parameter, the `err` property will indicate which parameter is invalid |
| 403 | The developer / OAuth token is invalid or expired |
| 404 | The specified file was not found |

### Examples [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#examples-1 "Direct link to Examples")

To get the JSON for specific nodes and their subtrees:

```text
GET /v1/files/:key/nodes?ids=1:2,1:3
```

To get the JSON for specific nodes and their direct children without any further descendants:

```text
GET /v1/files/:key/nodes?ids=1:2,1:3&depth=1
```

## GET image [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#get-images-endpoint "Direct link to GET image")

Renders images from a file.

If no error occurs, `images` will be populated with a map from node IDs to URLs of the rendered images, and `status` will be omitted. The image assets will expire after 30 days. Images up to 32 megapixels can be exported. Any images that are larger will be scaled down.

warning

**Important:** the image map may contain values that are null. This indicates that rendering of that specific node has failed. This may be due to the node id not existing, or other reasons such has the node having no renderable components. For example, a node that is invisible or has 0% opacity cannot be rendered. It is guaranteed that any node that was requested for rendering will be represented in this map whether or not the render succeeded.

To render multiple images from the same file, use the ids query parameter to specify multiple node ids.

```text
GET /v1/images/:key?ids=1:2,1:3,1:4
```

info

This is a [Tier 1 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`file_content:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP endpoint [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#http-endpoint-2 "Direct link to HTTP endpoint")

`GET /v1/images/:key`

**Return value**

```json
{
  "err": String,
  "images": Map<String, String>,
  "status": Number
}
```

| Path parameters | Description |
| --- | --- |
| key | StringFile to export images from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key. |

| Query parameters | Description |
| --- | --- |
| ids | StringA comma separated list of node IDs to render. |
| scale | NumberoptionalA number between 0.01 and 4, the image scaling factor |
| format | Stringoptional<br>The image output format, as a string enum.<br>- `jpg`<br>- `png`<br>- `svg`<br>- `pdf` |
| svg\_outline\_text | Booleanoptionaldefault: true<br>Whether text elements are rendered as outlines (vector paths) or as <text> elements in SVGs.<br>Rendering text elements as outlines guarantees that the text looks exactly the same in the SVG as it does in the browser/inside Figma.<br>Exporting as <text> allows text to be selectable inside SVGs and generally makes the SVG easier to read. However, this relies on the browser's rendering engine which can vary between browsers and/or operating systems. As such, visual accuracy is not guaranteed as the result could look different than in Figma. |
| svg\_include\_id | Booleanoptionaldefault: falseWhether to include id attributes for all SVG elements. Adds the layer name to the `id` attribute of an svg element. |
| svg\_include\_node\_id | Booleanoptionaldefault: falseWhether to include node id attributes for all SVG elements. Adds the node id to a `data-node-id` attribute of an svg element. |
| svg\_simplify\_stroke | Booleanoptionaldefault: trueWhether to simplify inside/outside strokes and use stroke attribute if possible instead of <mask>. |
| contents\_only | Booleanoptionaldefault: trueWhether content that overlaps the node should be excluded from rendering. Passing `false` (i.e., rendering overlaps) may increase processing time, since more of the document must be included in rendering. |
| use\_absolute\_bounds | Booleanoptionaldefault: falseUse the full dimensions of the node regardless of whether or not it is cropped or the space around it is empty. Use this to export text nodes without cropping. |
| version | StringoptionalA specific version ID to use. Omitting this will use the current version of the file. |

| Error codes | Description |
| --- | --- |
| 400 | Invalid parameter, the `err` property will indicate which parameter is invalid |
| 403 | The developer / OAuth token is invalid or expired |
| 404 | The specified file was not found |
| 500 | Unexpected rendering error, render could not be completed |

## GET image fills [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#get-image-fills-endpoint "Direct link to GET image fills")

Returns download links for all images present in image fills in a document. Image fills are how Figma represents any user supplied images. When you drag an image into Figma, we create a rectangle with a single fill that represents the image, and the user is able to transform the rectangle (and properties on the fill) as they wish.

This endpoint returns a mapping from image references to the URLs at which the images may be download. Image URLs will expire after no more than 14 days. Image references are located in the output of the [GET files](https://developers.figma.com/docs/rest-api/file-endpoints/#get-file) endpoint under the `imageRef` attribute in a [Paint](https://developers.figma.com/docs/rest-api/file-property-types/#paint-type).

info

This is a [Tier 2 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`file_content:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP endpoint [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#http-endpoint-3 "Direct link to HTTP endpoint")

`GET /v1/files/:key/images`

**Return value**

```json
{
  "images": {
    "$(imageRef)": String,
    ...
   },
}
```

| Path parameters | Description |
| --- | --- |
| key | StringFile to export images from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key. |

| Error codes | Description |
| --- | --- |
| 403 | The developer / OAuth token is invalid or expired |
| 404 | The specified file was not found |

## GET file metadata [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#get-file-metadata-endpoint "Direct link to GET file metadata")

Returns the metadata for the file referred to by `:key`. The file key can be parsed from any Figma file url: `https://www.figma.com/:file_type/:file_key/:file_name`.

info

This is a [Tier 3 endpoint](https://developers.figma.com/docs/rest-api/rate-limits/#rate-limits-tier-table) and requires the [`file_metadata:read` scope](https://developers.figma.com/docs/rest-api/scopes/).

### HTTP endpoint [​](https://developers.figma.com/docs/rest-api/file-endpoints/\#http-endpoint-4 "Direct link to HTTP endpoint")

`GET /v1/files/:key/meta`

**Return value**

```json
{
  "file": {
    "name": String,
    "folder_name": String,
    "last_touched_at": String,
    "creator": User,
    "last_touched_by": User,
    "thumbnail_url": String,
    "editorType": String,
    "version": String,
    "role": String,
    "link_access": String,
    "url": String,
   }
}
```

| Path parameters | Description |
| --- | --- |
| key | StringFile to export images from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key. |

| Error codes | Description |
| --- | --- |
| 403 | The developer / OAuth token is invalid or expired |
| 404 | The specified file was not found |

[Previous\\
\\
Property types](https://developers.figma.com/docs/rest-api/file-property-types/)

- [GET file](https://developers.figma.com/docs/rest-api/file-endpoints/#get-files-endpoint)
- [GET file nodes](https://developers.figma.com/docs/rest-api/file-endpoints/#get-file-nodes-endpoint)
- [GET image](https://developers.figma.com/docs/rest-api/file-endpoints/#get-images-endpoint)
- [GET image fills](https://developers.figma.com/docs/rest-api/file-endpoints/#get-image-fills-endpoint)
- [GET file metadata](https://developers.figma.com/docs/rest-api/file-endpoints/#get-file-metadata-endpoint)

Was this page helpful?

[Leave us feedback](https://form.asana.com/?k=6r2Tos6p01DyVKGLeYJByg&d=10497086658021)

* * *

- [Community Forum](https://forum.figma.com/)
- [Discord Server](https://discord.gg/xzQhe2Vcvx)
- [GitHub Samples](https://github.com/figma/widget-samples)

[FigJam](https://www.figma.com/figjam/)· [Enterprise](https://www.figma.com/enterprise/)· [Learn](https://help.figma.com/)· [Education](https://www.figma.com/education/)· [Careers](https://www.figma.com/careers/)· [Pricing](https://www.figma.com/pricing/)· [Developers](https://www.figma.com/developers)· [Blog](https://www.figma.com/blog/)· [Downloads](https://www.figma.com/downloads/)· [Releases](https://www.figma.com/release-notes/)· [Security](https://www.figma.com/security/)· [Legal](https://www.figma.com/legal)· [Contact](https://www.figma.com/contact/)