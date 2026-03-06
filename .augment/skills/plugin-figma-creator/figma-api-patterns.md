# Figma Plugin API Patterns Reference

Quick reference for common Figma Plugin API patterns. Consult when generating plugin code.

## Table of Contents

1. [Node Traversal](#node-traversal)
2. [Selection](#selection)
3. [Creating Nodes](#creating-nodes)
4. [Text and Fonts](#text-and-fonts)
5. [Colors and Fills](#colors-and-fills)
6. [Components and Variants](#components-and-variants)
7. [Storage](#storage)
8. [UI Communication](#ui-communication)
9. [Notifications](#notifications)
10. [Exporting](#exporting)

---

## Node Traversal

### Walk all nodes in current page
```ts
function walkNodes(node: BaseNode, callback: (node: BaseNode) => void) {
  callback(node);
  if ('children' in node) {
    for (const child of node.children) {
      walkNodes(child, callback);
    }
  }
}

walkNodes(figma.currentPage, (node) => {
  // process each node
});
```

### Find nodes by type
```ts
// All text nodes in page
const textNodes = figma.currentPage.findAll(
  (n) => n.type === 'TEXT'
) as TextNode[];

// First frame named "Header"
const header = figma.currentPage.findOne(
  (n) => n.type === 'FRAME' && n.name === 'Header'
) as FrameNode | null;

// All nodes matching criteria
const largeFrames = figma.currentPage.findAll(
  (n) => n.type === 'FRAME' && n.width > 500
) as FrameNode[];
```

### Find children (non-recursive)
```ts
const directTextChildren = frame.findChildren(
  (n) => n.type === 'TEXT'
) as TextNode[];
```

---

## Selection

### Read current selection
```ts
const selection = figma.currentPage.selection;

if (selection.length === 0) {
  figma.notify('Please select something first.');
  return;
}

for (const node of selection) {
  console.log(node.name, node.type);
}
```

### Set selection
```ts
figma.currentPage.selection = [node1, node2];
```

### Zoom to selection
```ts
figma.viewport.scrollAndZoomIntoView(figma.currentPage.selection);
```

### Listen for selection changes
```ts
figma.on('selectionchange', () => {
  const sel = figma.currentPage.selection;
  figma.ui.postMessage({
    type: 'selection-changed',
    payload: {
      count: sel.length,
      names: sel.map((n) => n.name),
    },
  });
});
```

---

## Creating Nodes

### Rectangle
```ts
const rect = figma.createRectangle();
rect.x = 0;
rect.y = 0;
rect.resize(200, 100);
rect.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 1 } }];
rect.cornerRadius = 8;
figma.currentPage.appendChild(rect);
```

### Frame
```ts
const frame = figma.createFrame();
frame.name = 'Card';
frame.resize(300, 200);
frame.layoutMode = 'VERTICAL';
frame.primaryAxisAlignItems = 'CENTER';
frame.counterAxisAlignItems = 'CENTER';
frame.itemSpacing = 12;
frame.paddingTop = frame.paddingBottom = 16;
frame.paddingLeft = frame.paddingRight = 16;
frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
```

### Auto Layout
```ts
frame.layoutMode = 'VERTICAL'; // or 'HORIZONTAL'
frame.primaryAxisSizingMode = 'AUTO'; // or 'FIXED'
frame.counterAxisSizingMode = 'AUTO'; // or 'FIXED'
frame.itemSpacing = 8;
frame.paddingTop = 12;
frame.paddingRight = 12;
frame.paddingBottom = 12;
frame.paddingLeft = 12;
```

---

## Text and Fonts

### Create text (always load font first)
```ts
const text = figma.createText();
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
text.characters = 'Hello, Figma!';
text.fontSize = 16;
text.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
```

### Change partial text style
```ts
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
text.setRangeFontName(0, 5, { family: 'Inter', style: 'Bold' });
text.setRangeFontSize(0, 5, 24);
text.setRangeFills(0, 5, [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]);
```

### Edit existing text
```ts
// Must load the font that's already in use
const fontName = text.fontName as FontName;
await figma.loadFontAsync(fontName);
text.characters = 'New content';
```

### Handle mixed fonts
```ts
if (text.fontName === figma.mixed) {
  // Text has multiple fonts; load each segment's font before editing
  const len = text.characters.length;
  for (let i = 0; i < len; i++) {
    const font = text.getRangeFontName(i, i + 1) as FontName;
    await figma.loadFontAsync(font);
  }
}
```

---

## Colors and Fills

### Hex to Figma RGB
```ts
function hexToRgb(hex: string): RGB {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16) / 255,
    g: parseInt(hex.substring(2, 4), 16) / 255,
    b: parseInt(hex.substring(4, 6), 16) / 255,
  };
}
```

### Figma RGB to Hex
```ts
function rgbToHex(color: RGB): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}
```

### Read fill color from a node
```ts
function getFillColor(node: GeometryMixin): RGB | null {
  const fills = node.fills as Paint[];
  if (fills.length > 0 && fills[0].type === 'SOLID') {
    return fills[0].color;
  }
  return null;
}
```

### Set fill with opacity
```ts
node.fills = [{
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0 },
  opacity: 0.5,
}];
```

---

## Components and Variants

### Create a component
```ts
const component = figma.createComponent();
component.name = 'Button';
component.resize(120, 40);
// add children...
```

### Create instance
```ts
const instance = component.createInstance();
instance.x = 200;
```

### Swap component on instance
```ts
const targetComponent = figma.currentPage.findOne(
  (n) => n.type === 'COMPONENT' && n.name === 'Button/Primary'
) as ComponentNode;

if (targetComponent) {
  instance.swapComponent(targetComponent);
}
```

---

## Storage

### Plugin data (attached to nodes, persists in file)
```ts
// Write
node.setPluginData('settings', JSON.stringify({ color: '#FF0000' }));

// Read
const raw = node.getPluginData('settings');
const data = raw ? JSON.parse(raw) : null;
```

### Client storage (persists per user, across files)
```ts
// Write
await figma.clientStorage.setAsync('preferences', { theme: 'dark' });

// Read
const prefs = await figma.clientStorage.getAsync('preferences');
```

---

## UI Communication

### Sandbox to UI
```ts
// In code.ts
figma.ui.postMessage({ type: 'data', payload: { items: [...] } });
```

### UI to Sandbox
```ts
// In ui.ts
parent.postMessage({ pluginMessage: { type: 'run', payload: {} } }, '*');
```

### Listening (both sides)
```ts
// code.ts
figma.ui.on('message', (msg) => {
  if (msg.type === 'run') { /* ... */ }
});

// ui.ts
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;
  if (msg.type === 'data') { /* ... */ }
};
```

---

## Notifications

```ts
figma.notify('Operation complete!');
figma.notify('Something went wrong', { error: true });
figma.notify('Processing...', { timeout: Infinity }); // dismiss manually
```

---

## Exporting

### Export node as PNG
```ts
const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
// Send bytes to UI for download
figma.ui.postMessage({ type: 'export', payload: Array.from(bytes) });
```

### Export as SVG
```ts
const svgString = await node.exportAsync({ format: 'SVG_STRING' });
```
