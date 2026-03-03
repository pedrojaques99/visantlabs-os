---
name: plugin-figma-creator
description: >
  Create production-ready Figma plugins with UI from scratch. Generates complete project structure
  including manifest.json, TypeScript source, HTML UI, build config, and setup instructions.
  Use this skill whenever the user mentions creating a Figma plugin, building a Figma extension,
  automating Figma tasks via plugin, or wants to scaffold a plugin project. Also trigger when
  the user asks about Figma Plugin API patterns, plugin UI communication, or node manipulation.
  Even if the user just says "plugin for Figma" or "automate something in Figma", use this skill.
---

# Figma Plugin Creator

Generate complete, buildable Figma plugin projects with TypeScript and HTML UI.

## What this skill produces

A full plugin project ready to load in Figma Desktop:

```
plugin-name/
├── manifest.json          # Plugin metadata and config
├── package.json           # Dependencies and build scripts
├── tsconfig.json          # TypeScript config
├── webpack.config.js      # Build pipeline
├── src/
│   ├── code.ts            # Main plugin logic (runs in Figma sandbox)
│   ├── ui.html            # Plugin UI (runs in iframe)
│   ├── ui.ts              # UI logic (compiled and inlined)
│   └── types.ts           # Shared type definitions
└── README.md              # Setup and usage instructions
```

## Architecture mental model

Think of a Figma plugin as two separate worlds connected by a mailbox:

1. **Sandbox (code.ts)**: Has access to the Figma document (nodes, pages, styles) but NO access to browser APIs, DOM, or network. This is where you read/write the design file.

2. **UI iframe (ui.html + ui.ts)**: A normal web page with full browser APIs (DOM, fetch, localStorage) but ZERO access to the Figma document.

3. **Message passing**: The only bridge between them. The sandbox sends messages via `figma.ui.postMessage(data)` and listens via `figma.ui.on('message', handler)`. The UI sends via `parent.postMessage({ pluginMessage: data }, '*')` and listens via `window.onmessage`.

This separation is non-negotiable. Never try to access `figma.*` from the UI or `document.*` from the sandbox.

## Step-by-step workflow

### 1. Clarify the plugin's purpose

Before generating code, understand:
- What does the plugin do? (e.g., "batch rename layers", "export tokens", "generate grids")
- What Figma nodes does it interact with? (selection, all nodes, specific types)
- Does it need network access? If so, which domains?
- Does it need to store settings? (pluginData vs clientStorage)

### 2. Generate the project

Read `references/figma-api-patterns.md` for common API patterns, then generate all files using the templates below.

#### manifest.json

```json
{
  "name": "{{PLUGIN_NAME}}",
  "id": "000000000000000000",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "documentAccess": "dynamic-page",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["none"]
  }
}
```

Key rules:
- `id` should be `"000000000000000000"` as placeholder (Figma assigns real ID on publish)
- `documentAccess` must be `"dynamic-page"` for all new plugins
- `editorType` can include `"figjam"` or `"dev"` if needed
- Update `networkAccess.allowedDomains` if the plugin calls external APIs
- Add `"permissions"` array if using `currentuser`, `activeusers`, etc.

#### package.json

```json
{
  "name": "{{plugin-name-kebab}}",
  "version": "1.0.0",
  "description": "{{Plugin description}}",
  "scripts": {
    "build": "webpack --mode=production",
    "watch": "webpack --mode=development --watch"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.100.0",
    "typescript": "^5.5.0",
    "ts-loader": "^9.5.0",
    "webpack": "^5.90.0",
    "webpack-cli": "^5.1.0",
    "html-webpack-plugin": "^5.6.0",
    "css-loader": "^7.1.0",
    "style-loader": "^4.0.0"
  }
}
```

#### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "typeRoots": ["./node_modules/@figma"]
  },
  "include": ["src/**/*.ts"]
}
```

#### webpack.config.js

```js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => ({
  entry: {
    code: './src/code.ts',
    ui: './src/ui.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/ui.html',
      filename: 'ui.html',
      chunks: ['ui'],
      inject: 'body',
      inlineSource: '.(js|css)$',
    }),
  ],
});
```

#### src/types.ts

Always define a shared message protocol:

```ts
// Messages from UI to Sandbox
export type UIMessage =
  | { type: 'create'; payload: { name: string; count: number } }
  | { type: 'cancel' };

// Messages from Sandbox to UI
export type SandboxMessage =
  | { type: 'selection-changed'; payload: { count: number; names: string[] } }
  | { type: 'done' };
```

#### src/code.ts (sandbox)

```ts
figma.showUI(__html__, { width: 320, height: 480, themeColors: true });

figma.ui.on('message', async (msg) => {
  if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }

  // Handle messages from UI...

  figma.ui.postMessage({ type: 'done' });
});
```

#### src/ui.html

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Inter, system-ui, sans-serif;
      font-size: 11px;
      color: var(--figma-color-text);
      background: var(--figma-color-bg);
      padding: 12px;
    }
    button {
      background: var(--figma-color-bg-brand);
      color: var(--figma-color-text-onbrand);
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 11px;
      cursor: pointer;
      width: 100%;
    }
    button:hover { opacity: 0.9; }
    button.secondary {
      background: var(--figma-color-bg-secondary);
      color: var(--figma-color-text);
    }
    input, select {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--figma-color-border);
      border-radius: 4px;
      background: var(--figma-color-bg);
      color: var(--figma-color-text);
      font-size: 11px;
    }
    .section { margin-bottom: 12px; }
    .label { font-weight: 600; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div id="app">
    <!-- Plugin UI here -->
  </div>
</body>
</html>
```

#### src/ui.ts

```ts
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  // Handle messages from sandbox...
};

function sendMessage(msg: any) {
  parent.postMessage({ pluginMessage: msg }, '*');
}
```

### 3. Generate README.md

Always include setup instructions:

```markdown
# {{Plugin Name}}

{{Description}}

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the plugin:
   ```bash
   npm run build
   ```

3. Load in Figma:
   - Open Figma Desktop
   - Go to Plugins > Development > Import plugin from manifest...
   - Select the `manifest.json` file from this folder

4. For development with auto-rebuild:
   ```bash
   npm run watch
   ```

## Usage

{{Usage instructions}}
```

### 4. Deliver the project

Save all files to `/home/claude/{{plugin-name}}/`, then copy to `/mnt/user-data/outputs/{{plugin-name}}/` and present.

## Common pitfalls to avoid

1. **Forgetting `documentAccess: "dynamic-page"`**: Required for all new plugins. Without it, Figma loads all pages on plugin start (slow).

2. **Accessing figma.* from UI code**: Won't work. The UI runs in an isolated iframe. Use message passing.

3. **Using `figma.currentPage.selection` without checking emptiness**: Always guard with `if (selection.length === 0)`.

4. **Not calling `figma.closePlugin()`**: If the plugin has no UI or runs once, always close it. With UI, close on cancel/done.

5. **Hardcoding colors instead of using `var(--figma-color-*)`**: Always use Figma's CSS variables so the UI respects light/dark theme.

6. **Missing `themeColors: true` in `figma.showUI()`**: Required for CSS variables to work.

7. **Not handling async operations properly**: Many Figma API calls (like `loadFontAsync`) are async. Always await them.

## For deeper API reference

Read `references/figma-api-patterns.md` for patterns covering:
- Node traversal and filtering
- Working with text (font loading, styles)
- Colors and fills
- Component and variant manipulation
- Plugin data storage
- Selection handling
