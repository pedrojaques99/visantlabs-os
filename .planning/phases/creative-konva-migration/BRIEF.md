# Phase Brief: creative-konva-migration

## Phase Goal

Replace the DOM-based creative canvas (react-moveable + dom-to-image-more) with a
Konva/react-konva render pipeline that supports layer selection, drag, resize, text
editing, PNG export at native format resolution, and automatic thumbnail capture.

## Requirement Definitions

| ID | Description | Plan |
|----|-------------|------|
| KONVA-DEPS | Install react-konva, konva, use-image at pinned compatible versions (React 19 + Vite 6 + TS 5.8). No legacy peer-dep flags. | 01 |
| KONVA-TYPES | Extend `TextLayerData`, `LogoLayerData`, `ShapeLayerData` with optional `opacity`, `shadowColor`, `shadowBlur`, `shadowOffsetX`, `shadowOffsetY` props that map 1:1 to Konva node props. | 01 |
| KONVA-CANVAS-SHELL | Create `KonvaCanvas.tsx` — a `forwardRef<Konva.Stage>` component that renders Stage + Layer + background image + overlay Rect, hosts placeholder layer rendering, includes Transformer wiring, and preserves drag-drop and LassoTool. | 02 |
| KONVA-TEXT | Create `KonvaTextLayer.tsx` — renders a Konva `<Text>` node with drag, transform (scale-reset), double-click textarea overlay edit (Enter/Escape/Blur commits), store persistence, Transformer registration, and optional opacity/shadow props. | 03 |
| KONVA-LOGO | Create `KonvaLogoLayer.tsx` — renders a Konva `<Image>` loaded via `use-image('anonymous')` with memoized proxied URL, drag, transform (scale-reset), store persistence, Transformer registration, and optional opacity/shadow props. | 03 |
| KONVA-SHAPE | Create `KonvaShapeLayer.tsx` — renders a Konva `<Rect>` with fill color, drag, transform (scale-reset), store persistence, Transformer registration, and optional opacity/shadow props. | 03 |
| KONVA-LAYER-DISPATCH | Patch `KonvaCanvas.tsx` to replace the Wave 2 placeholder Rect with a type-dispatched render of `KonvaTextLayer` / `KonvaLogoLayer` / `KonvaShapeLayer`. Expose a stable `registerNode` callback via `useCallback`. | 03 |
| KONVA-EXPORT | Rewrite `exportPng.ts` to accept a `Konva.Stage` (not `HTMLElement`) and export at native format resolution via `stage.toDataURL({ pixelRatio })`. Remove `dom-to-image-more` usage. | 04 |
| KONVA-THUMBNAIL | Rewrite `captureThumbnail.ts` to accept a `Konva.Stage` and return a `≤480px` data URL via `stage.toDataURL` at computed small pixelRatio. Returns `null` on null stage (no throw). | 04 |
| KONVA-WIRE-STUDIO | Update `CreativeStudio.tsx` to import `KonvaCanvas` instead of `CreativeCanvas`, retype `canvasRef` as `useRef<Konva.Stage>(null)`, and update export/thumbnail call sites. Pass a blocking smoke-test checkpoint. | 04 |
| KONVA-CLEANUP | Delete five dead DOM-era files (`CreativeCanvas.tsx`, `CreativeMoveable.tsx`, `TextLayer.tsx`, `LogoLayer.tsx`, `ShapeLayer.tsx`). Remove `react-moveable`, `react-selecto`, `dom-to-image-more` from `package.json`. Full typecheck passes. | 04 |

## Wave Structure

| Wave | Plan | Requirements Addressed |
|------|------|------------------------|
| 1 | 01 | KONVA-DEPS, KONVA-TYPES |
| 2 | 02 | KONVA-CANVAS-SHELL |
| 3 | 03 | KONVA-TEXT, KONVA-LOGO, KONVA-SHAPE, KONVA-LAYER-DISPATCH |
| 4 | 04 | KONVA-EXPORT, KONVA-THUMBNAIL, KONVA-WIRE-STUDIO, KONVA-CLEANUP |
