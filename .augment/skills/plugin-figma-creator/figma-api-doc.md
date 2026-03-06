{
  "pluginApiDocumentation": {
    "markdown": "\n# Figma Plugin API Documentation\n\nThe Figma Plugin API provides methods and properties to interact with the Figma editor.\n\n## The `figma` Global Object\n\n### Properties\n- `apiVersion`: The version of the Figma API this plugin is running on.\n- `currentPage`: The page the user is currently viewing.\n- `viewport`: Methods to read and set the user-visible area.\n- `currentUser`: Details about the current user (requires `currentuser` permission).\n\n### Methods\n- `showUI(html: string, options?: ShowUIOptions)`: Renders UI in a modal dialog.\n- `closePlugin(message?: string)`: Closes the plugin.\n- `notify(message: string, options?: NotificationOptions)`: Shows a notification.\n",
    "markdown_citation": "https://developers.figma.com/docs/plugins/api/figma/",
    "json": {
      "global_object": "figma",
      "version": "1.0.0",
      "main_properties": [
        "currentPage",
        "viewport",
        "root",
        "currentUser",
        "command"
      ],
      "main_methods": [
        "showUI",
        "closePlugin",
        "notify",
        "getNodeByIdAsync"
      ]
    }
  },
  "restApiDocumentation": {
    "markdown": "\n# Figma REST API Documentation\n\nThe Figma REST API allows programmatic access to Figma files and resources.\n\n## Base URL\n`https://api.figma.com`\n\n## Core Endpoints\n- `GET /v1/files/:key`: Returns the document as a JSON object.\n- `GET /v1/files/:key/nodes`: Returns specific nodes from a file.\n- `GET /v1/images/:key`: Renders images of file nodes.\n- `GET /v1/files/:key/comments`: Gets comments in a file.\n",
    "markdown_citation": "https://developers.figma.com/docs/rest-api/",
    "json": {
      "openapi": "3.1.0",
      "info": {
        "title": "Figma API",
        "version": "0.36.0"
      },
      "servers": [
        {
          "url": "https://api.figma.com"
        }
      ],
      "paths": {
        "/v1/files/{file_key}": {
          "get": {
            "summary": "Get file JSON"
          }
        },
        "/v1/images/{file_key}": {
          "get": {
            "summary": "Render images"
          }
        },
        "/v1/me": {
          "get": {
            "summary": "Get current user"
          }
        }
      }
    }
  },
  "nodeCreation": {
    "markdown": "\n# Node Creation in Figma Plugin API\n\nPlugins can create various types of nodes using the following methods on the `figma` object:\n\n| Method | Return Type | Description |\n|---|---|---|\n| `createRectangle()` | `RectangleNode` | Creates a new rectangle. |\n| `createLine()` | `LineNode` | Creates a new line. |\n| `createEllipse()` | `EllipseNode` | Creates a new ellipse. |\n| `createPolygon()` | `PolygonNode` | Creates a new polygon (triangle by default). |\n| `createStar()` | `StarNode` | Creates a new star. |\n| `createVector()` | `VectorNode` | Creates a new empty vector network. |\n| `createText()` | `TextNode` | Creates a new empty text node. |\n| `createFrame()` | `FrameNode` | Creates a new frame. |\n| `createComponent()` | `ComponentNode` | Creates a new empty component. |\n| `createPage()` | `PageNode` | Creates a new page. |\n| `createSection()` | `SectionNode` | Creates a new section. |\n| `createNodeFromSvg(svg: string)` | `FrameNode` | Creates a node from an SVG string. |\n",
    "markdown_citation": "https://developers.figma.com/docs/plugins/api/figma/#creation",
    "json": {
      "creation_methods": [
        {
          "method": "createRectangle",
          "return_type": "RectangleNode"
        },
        {
          "method": "createLine",
          "return_type": "LineNode"
        },
        {
          "method": "createEllipse",
          "return_type": "EllipseNode"
        },
        {
          "method": "createText",
          "return_type": "TextNode"
        },
        {
          "method": "createFrame",
          "return_type": "FrameNode"
        },
        {
          "method": "createComponent",
          "return_type": "ComponentNode"
        },
        {
          "method": "createSection",
          "return_type": "SectionNode"
        }
      ]
    }
  },
  "canvasManipulation": {
    "markdown": "\n# Canvas Manipulation\n\n## Selection\nThe `selection` property on `figma.currentPage` allows you to read and set the current selection.\n- `figma.currentPage.selection: SceneNode[]`\n\n## Viewport\nThe `figma.viewport` object provides methods to manipulate the user's view:\n- `scrollAndZoomIntoView(nodes: SceneNode[])`: Zooms the viewport to fit the specified nodes.\n- `zoom: number`: Gets or sets the viewport zoom level.\n- `center: { x: number, y: number }`: Gets or sets the viewport center coordinates.\n",
    "markdown_citation": "https://developers.figma.com/docs/plugins/api/figma/#viewport",
    "json": {
      "selection": {
        "access": "figma.currentPage.selection",
        "type": "SceneNode[]"
      },
      "viewport": {
        "methods": [
          "scrollAndZoomIntoView"
        ],
        "properties": [
          "zoom",
          "center"
        ]
      }
    }
  },
  "manifestSchema": {
    "json": {
      "name": "string",
      "id": "string",
      "api": "string",
      "main": "string",
      "ui": "string | { [key: string]: string }",
      "editorType": [
        "figma",
        "figjam",
        "dev",
        "slides"
      ],
      "networkAccess": {
        "allowedDomains": [
          "string"
        ],
        "reasoning": "string"
      },
      "permissions": [
        "string"
      ],
      "codegenLanguages": [
        {
          "label": "string",
          "value": "string"
        }
      ]
    }
  }
}