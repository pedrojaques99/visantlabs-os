[Skip to main content](https://developers.figma.com/docs/rest-api/#__docusaurus_skipToContent_fallback)

On this page

Welcome to Figma, the world's first collaborative interface design tool. Figma allows designers to create and prototype their digital experiences - together in real-time and in one place - helping them turn their ideas and visions into products, faster. Figma's mission is to make design accessible to everyone. The Figma API is one of the ways we aim to do that.

## What can I do with the Figma API? [​](https://developers.figma.com/docs/rest-api/\#what-can-i-do-with-the-figma-api "Direct link to What can I do with the Figma API?")

The Figma API supports access and interactions with Figma's different products. This gives you the ability to do things such as view and extract any objects or layers, and their properties from files, get usage data, or listen for events with webhooks, among other things.

## How does it work? [​](https://developers.figma.com/docs/rest-api/\#how-does-it-work "Direct link to How does it work?")

The Figma API is based on the [REST](https://en.wikipedia.org/wiki/Representational_state_transfer) structure. We support authentication via [access tokens](https://developers.figma.com/docs/rest-api/authentication/#access-tokens) and [OAuth2](https://developers.figma.com/docs/rest-api/authentication/#oauth-apps). Requests are made via **HTTP endpoints** with clear functions and appropriate response codes. Endpoints allow you to perform a number of actions:

- Make requests for different resources:
  - [Files](https://developers.figma.com/docs/rest-api/file-endpoints/)
  - [Images](https://developers.figma.com/docs/rest-api/file-endpoints/#get-images-endpoint)
  - [File versions](https://developers.figma.com/docs/rest-api/version-history-endpoints/)
  - [Users](https://developers.figma.com/docs/rest-api/users-endpoints/)
  - [Comments](https://developers.figma.com/docs/rest-api/comments-endpoints/)
  - [Projects](https://developers.figma.com/docs/rest-api/projects-endpoints/)
  - [Components and styles](https://developers.figma.com/docs/rest-api/component-endpoints/)
- Work with [variables](https://developers.figma.com/docs/rest-api/variables-endpoints/)
- Manage [dev resources](https://developers.figma.com/docs/rest-api/dev-resources-endpoints/)
- Get usage and analytics data:
  - [Activity logs](https://developers.figma.com/docs/rest-api/activity-logs-endpoints/)
  - [Text events](https://developers.figma.com/docs/rest-api/discovery-endpoints/)
  - [Library analytics](https://developers.figma.com/docs/rest-api/library-analytics-endpoints/)
- Create and manage [webhooks](https://developers.figma.com/docs/rest-api/webhooks-endpoints/)

Once granted access, you can use the Figma API to inspect a **JSON** representation of the file. Every layer or object in a file will be represented within the file by a node (subtree). You will then be able to access and isolate the object and any properties associated with it. In addition to accessing files and layers, you will be able to GET and POST comments to files.

### Base URL [​](https://developers.figma.com/docs/rest-api/\#base-url "Direct link to Base URL")

All REST API endpoints use the same base URL: `https://api.figma.com`

For example: `GET https://api.figma.com/v1/files/:key`

For Figma for Government, the base URL is: `https://api.figma-gov.com`

For example: `GET https://api.figma-gov.com/v1/activity_logs`

note

**Note:** The REST API documentation for endpoints generally refers to the common base URL, `https://api.figma.com`. If you're a Figma for Government customer, replace the common base URL with the Figma for Government version.

## Getting started [​](https://developers.figma.com/docs/rest-api/\#getting-started "Direct link to Getting started")

If you’re not already using Figma, the first step is to sign up and [create an account](https://www.figma.com/signup).

Once you have a Figma account, the next step is to authenticate with the API. This can be done using either [OAuth2](https://developers.figma.com/docs/rest-api/authentication/#oauth-apps) or [access tokens](https://developers.figma.com/docs/rest-api/authentication/#access-tokens).

You can then browse our endpoints and start making queries against the Figma API. We recommend starting with the basics by learning about [Figma files](https://developers.figma.com/docs/rest-api/file-endpoints/), before moving on to more advanced topics such as comments, users, version history, and projects.

If you plan on building a fully-fledged app, that others can share and use, then you can register your app by heading to [My apps](https://www.figma.com/developers/apps) in your Figma account.

## OpenAPI specification [​](https://developers.figma.com/docs/rest-api/\#openapi-specification "Direct link to OpenAPI specification")

The Figma REST API is fully described in an OpenAPI specification in the open source [figma/rest-api-spec](https://github.com/figma/rest-api-spec) repository.

OpenAPI is a specification for describing HTTP APIs in a language-agnostic manner. It has a large ecosystem of tools to let you generate API documentation, client SDKs, and more. We also provide custom Typescript types generated from the OpenAPI specification for those of you with Typescript codebases to make it easy to write type-safe code out of the box. For more information, see the [README](https://github.com/figma/rest-api-spec).

- [What can I do with the Figma API?](https://developers.figma.com/docs/rest-api/#what-can-i-do-with-the-figma-api)
- [How does it work?](https://developers.figma.com/docs/rest-api/#how-does-it-work)
  - [Base URL](https://developers.figma.com/docs/rest-api/#base-url)
- [Getting started](https://developers.figma.com/docs/rest-api/#getting-started)
- [OpenAPI specification](https://developers.figma.com/docs/rest-api/#openapi-specification)

Was this page helpful?

[Leave us feedback](https://form.asana.com/?k=6r2Tos6p01DyVKGLeYJByg&d=10497086658021)

* * *

- [Community Forum](https://forum.figma.com/)
- [Discord Server](https://discord.gg/xzQhe2Vcvx)
- [GitHub Samples](https://github.com/figma/widget-samples)