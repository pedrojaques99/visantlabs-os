---
phase: creative-konva-migration
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/components/creative/KonvaCanvas.tsx
autonomous: true
requirements:
  - KONVA-CANVAS-SHELL
must_haves:
  truths:
    - "KonvaCanvas renders a Konva Stage at preview width/height"
    - "Background image and overlay render inside the Stage at the bottom of the Layer"
    - "Drag-and-drop from sidebar still creates new layers via store.addLayer (text/shape/logo)"
    - "Stage container hosts LassoTool unchanged (DOM overlay)"
    - "forwardRef exposes Konva.Stage via .current for export consumers"
  artifacts:
    - path: src/components/creative/KonvaCanvas.tsx
      provides: "Forwarded Konva.Stage host that renders bg + overlay + per-layer Konva nodes"
      min_lines: 120
      contains: "Stage"
  key_links:
    - from: "KonvaCanvas.tsx"
      to: "react-konva Stage / Layer / Rect / Image"
      via: "import"
      pattern: "from 'react-konva'"
    - from: "KonvaCanvas.tsx"
      to: "use-image"
      via: "default import"
      pattern: "from 'use-image'"
    - from: "KonvaCanvas.tsx"
      to: "useCreativeStore (backgroundUrl, overlay, layers, addLayer, setSelectedLayerIds, setBackgroundSelected)"
      via: "Zustand selectors"
      pattern: "useCreativeStore"
    - from: "KonvaCanvas.tsx"
      to: "LassoTool"
      via: "DOM overlay rendered as sibling of Stage"
      pattern: "LassoTool"
---

<objective>
Build the new `KonvaCanvas.tsx` shell — a `forwardRef<Konva.Stage>` component that renders
the Stage + Layer with background image + overlay rect, hosts the (yet-to-be-built) Konva
layer components, and preserves the existing drag-drop behavior + LassoTool overlay.

Purpose: This is the new render surface that replaces `CreativeCanvas.tsx`. Wave 3 ports
(Text/Logo/Shape Konva components) drop into this shell. Wave 4 wires it into CreativeStudio.

NOTE: Component creation is explicitly approved as part of this migration phase per the
planning decision. `KonvaCanvas.tsx` is a new file introduced by this migration — it does
not violate the "no new UI components without permission" rule in CLAUDE.md.

Output:
- A NEW file `src/components/creative/KonvaCanvas.tsx` (does NOT modify existing
  `CreativeCanvas.tsx` — we keep it alive until Wave 4 wires the swap).
- Renders Stage + Layer + background Image + overlay Rect.
- Per-layer rendering uses TEMPORARY placeholder Rects (one per layer) — Wave 3
  replaces these with KonvaTextLayer / KonvaLogoLayer / KonvaShapeLayer components.
- Transformer + selection wiring is INCLUDED (since it shares Stage state).

Why include Transformer here (not a separate plan): Transformer must live inside the
same `<Layer>` as the nodes it controls (RESEARCH.md Pattern 2 + Pitfall 3). Splitting
it from the Stage owner creates a forwarding/ref nightmare. One plan, one component.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/creative-konva-migration/RESEARCH.md
@src/components/creative/CreativeCanvas.tsx
@src/components/creative/CreativeMoveable.tsx
@src/components/creative/store/creativeStore.ts
@src/components/creative/LassoTool.tsx
@src/lib/pixel.ts
@src/utils/proxyUtils.ts

<interfaces>
<!-- Public contract this plan produces -->

```typescript
// src/components/creative/KonvaCanvas.tsx
import type Konva from 'konva';

interface KonvaCanvasProps {
  width: number;
  height: number;
  accentColor: string;     // forwarded for Wave 3 KonvaTextLayer accent stripping
  defaultFont: string;     // used when adding new text via drag-drop
}

export const KonvaCanvas: React.ForwardRefExoticComponent<
  KonvaCanvasProps & React.RefAttributes<Konva.Stage>
>;
```

<!-- Store selectors used (read-only) -->
- `backgroundUrl: string | null`
- `overlay: CreativeOverlay | null`  // { type: 'gradient'|'solid', direction?, opacity, color? }
- `layers: CreativeLayer[]`
- `selectedLayerIds: string[]`
- `addLayer(data: CreativeLayerData)`
- `setSelectedLayerIds(ids: string[], extend?: boolean)`
- `setBackgroundSelected(v: boolean)`

<!-- LassoTool contract (UNCHANGED) -->
- LassoTool reads `e.currentTarget.getBoundingClientRect()` from a DOM div.
- It is rendered as a sibling DOM overlay over the Stage container, NOT inside the Stage.

<!-- Existing util signatures referenced -->
```typescript
// src/utils/proxyUtils.ts
export function getProxiedUrl(url: string | null | undefined): string;

// src/lib/pixel.ts
export const normalizePoint: (p: Point, total: Size) => Point;
export const normalizeSize:  (s: Size, total: Size) => Size;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create KonvaCanvas.tsx shell with Stage + Layer + Background + Overlay + Transformer</name>
  <files>src/components/creative/KonvaCanvas.tsx</files>
  <read_first>
    - Z:/Cursor/visantlabs-os/src/components/creative/CreativeCanvas.tsx (the file we're replacing — copy drag-drop handler verbatim, copy overlay logic but adapt to Konva)
    - Z:/Cursor/visantlabs-os/src/components/creative/CreativeMoveable.tsx (Transformer + selection logic to port)
    - Z:/Cursor/visantlabs-os/.planning/phases/creative-konva-migration/RESEARCH.md (Pattern 2: Stage + Layer + Shared Transformer; Pattern 6: Background Image; Pattern 7: Overlay; Pitfall 5: useImage memoization)
    - Z:/Cursor/visantlabs-os/src/components/creative/LassoTool.tsx (top of file — confirms it reads bounding rect from its parent div)
    - Z:/Cursor/visantlabs-os/src/utils/proxyUtils.ts (signature of getProxiedUrl)
  </read_first>
  <action>
    Create a NEW file at `src/components/creative/KonvaCanvas.tsx`. Do NOT delete or
    modify `CreativeCanvas.tsx` in this task — Wave 4 handles the swap.

    Skeleton (copy this; fill in details from RESEARCH.md):

    ```typescript
    import React, { forwardRef, useRef, useEffect, useMemo } from 'react';
    import { Stage, Layer, Rect, Image as KonvaImage, Transformer } from 'react-konva';
    import useImage from 'use-image';
    import Konva from 'konva';
    import { useCreativeStore } from './store/creativeStore';
    import { LassoTool } from './LassoTool';
    import { getProxiedUrl } from '@/utils/proxyUtils';

    interface Props {
      width: number;
      height: number;
      accentColor: string;
      defaultFont: string;
    }

    export const KonvaCanvas = forwardRef<Konva.Stage, Props>(
      ({ width, height, accentColor, defaultFont }, ref) => {
        const {
          backgroundUrl, overlay, layers,
          selectedLayerIds, addLayer,
          setSelectedLayerIds, setBackgroundSelected,
        } = useCreativeStore();

        // Shared Transformer ref + per-layer node ref map (Wave 3 layer components
        // will write into shapeRefs via a registration callback we expose via context
        // or props — for THIS task, just expose the empty Map and Transformer; Wave 3
        // wires the per-layer registration).
        const trRef = useRef<Konva.Transformer>(null);
        const shapeRefs = useRef<Map<string, Konva.Node>>(new Map());

        // Memoize proxied bg URL to prevent useImage re-render loop (RESEARCH Pitfall 5)
        const proxiedBgUrl = useMemo(
          () => (backgroundUrl ? getProxiedUrl(backgroundUrl) : ''),
          [backgroundUrl]
        );
        const [bgImage] = useImage(proxiedBgUrl, 'anonymous');

        // Sync selection -> Transformer (RESEARCH Pattern 2)
        useEffect(() => {
          if (!trRef.current) return;
          const nodes = selectedLayerIds
            .map((id) => shapeRefs.current.get(id))
            .filter((n): n is Konva.Node => !!n);
          trRef.current.nodes(nodes);
          trRef.current.getLayer()?.batchDraw();
        }, [selectedLayerIds, layers]);

        // Drag-drop handler — port verbatim from CreativeCanvas.tsx, but read bounds
        // from the wrapper div (Stage's container()). Use Stage.container() ref.
        const stageRef = useRef<Konva.Stage>(null);
        // forward both refs (caller's + local stageRef) — see "double-ref" snippet below.

        // ... (drag-drop, overlay rendering, JSX) ...
      }
    );
    KonvaCanvas.displayName = 'KonvaCanvas';
    ```

    ── Detail 1: Double-ref forwarding ──
    Caller passes `ref` typed as `React.Ref<Konva.Stage>`. We also need our own
    `stageRef` for internal use. Use this pattern (no extra deps):

    ```typescript
    const stageRef = useRef<Konva.Stage>(null);
    const setStageRef = (node: Konva.Stage | null) => {
      stageRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<Konva.Stage | null>).current = node;
    };
    // <Stage ref={setStageRef} ... />
    ```

    ── Detail 2: Drag-drop ──
    Stage doesn't natively support HTML drag-drop. Wrap the Stage in a `<div>` that
    handles `onDragOver` + `onDrop`. Compute drop coordinates from
    `e.currentTarget.getBoundingClientRect()` (same as CreativeCanvas.tsx today).
    Port the existing branches verbatim:
    - `type === 'text'` → addLayer({ type:'text', content:'Novo texto', role:'body', ...defaults from CreativeCanvas.tsx lines 35-46 })
    - `type === 'shape'` → addLayer({ type:'shape', shape:'rect', color: accentColor, ... lines 47-54 })
    - `url` (logo/image) → addLayer({ type:'logo', url, ... lines 55-61 })

    ── Detail 3: Background image ──
    Render INSIDE the `<Layer>`, FIRST child (Konva = first = bottom), only if
    `bgImage` is loaded. `listening={false}`:

    ```typescript
    {bgImage && (
      <KonvaImage
        image={bgImage}
        x={0} y={0}
        width={width} height={height}
        listening={false}
      />
    )}
    ```

    ── Detail 4: Overlay ──
    Port the gradient/solid logic from CreativeCanvas.tsx lines 65-82 to a Konva Rect
    using `fillLinearGradientStartPoint/EndPoint/ColorStops` for gradient or
    `fill` + `opacity` for solid. RESEARCH.md Pattern 7 has both variants.
    `listening={false}`. Place AFTER background image, BEFORE layers.

    ── Detail 5: Layer rendering (PLACEHOLDER) ──
    For this task, render a SIMPLE PLACEHOLDER `<Rect>` per layer (so dev can see
    something during Wave 2 -> Wave 3 transition). Wave 3 replaces this with the
    real KonvaTextLayer / KonvaLogoLayer / KonvaShapeLayer components.

    ```typescript
    {layers.filter(l => l.visible).map((layer) => (
      <Rect
        key={layer.id}
        x={layer.data.position.x * width}
        y={layer.data.position.y * height}
        width={(layer.data.size?.w ?? 0.1) * width}
        height={(layer.data.size?.h ?? 0.1) * height}
        fill="rgba(255,0,255,0.2)"  // visible placeholder, easy to grep
        stroke="rgba(255,0,255,0.6)"
        strokeWidth={1}
        ref={(node) => {
          if (node) shapeRefs.current.set(layer.id, node);
          else shapeRefs.current.delete(layer.id);
        }}
        onClick={(e) => {
          const isShift = e.evt.shiftKey;
          setSelectedLayerIds([layer.id], isShift);
        }}
      />
    ))}
    ```

    Add a comment above this block:
    ```
    // TODO(creative-konva-migration Wave 3): replace placeholder Rect with
    // KonvaTextLayer / KonvaLogoLayer / KonvaShapeLayer dispatch.
    ```

    ── Detail 6: Transformer ──
    LAST child of `<Layer>` (RESEARCH Pitfall 3 — must be in same Layer):

    ```typescript
    <Transformer
      ref={trRef}
      keepRatio={false}
      rotateEnabled={false}
      anchorSize={8}
      borderStroke="rgba(0,229,255,0.8)"
      anchorStroke="rgba(0,229,255,0.8)"
      anchorFill="#0a0a0a"
    />
    ```

    Rotation: keep DISABLED in this phase (current react-moveable config doesn't use
    rotation either — see CreativeMoveable.tsx, no rotatable prop). Re-enable later if
    needed.

    ── Detail 7: Background-click → setBackgroundSelected ──
    On Stage `onClick`, if `e.target === e.target.getStage()` (i.e. clicked empty
    canvas, not a node), call `setBackgroundSelected(true)`. This preserves the
    behavior at CreativeCanvas.tsx lines 94-98.

    ── Detail 8: LassoTool overlay ──
    LassoTool stays a DOM sibling. Render it OUTSIDE the Stage but INSIDE the wrapper
    div (so its `getBoundingClientRect()` matches the Stage's pixel space):

    ```typescript
    return (
      <div
        className="relative shadow-2xl bg-black overflow-visible selection-none"
        style={{ width, height }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Stage ref={setStageRef} width={width} height={height} onClick={handleStageClick}>
          <Layer>
            {/* bg, overlay, layers, transformer */}
          </Layer>
        </Stage>
        <LassoTool canvasWidth={width} canvasHeight={height} />
      </div>
    );
    ```

    ── DO NOT in this task ──
    - Do NOT modify CreativeCanvas.tsx (Wave 4 swaps the import in CreativeStudio).
    - Do NOT modify CreativeMoveable.tsx (Wave 4 deletes it).
    - Do NOT touch the store.
    - Do NOT add real text editing / image loading / shape rendering — that is Wave 3.
      Placeholders are intentional.
    - Do NOT add box-selection / Selecto replacement (deferred per scope_constraints).
    - Do NOT call `node.cache()` anywhere (no filters in this phase).
  </action>
  <verify>
    <automated>npx tsc --noEmit -p Z:/Cursor/visantlabs-os && grep -q "forwardRef<Konva.Stage" Z:/Cursor/visantlabs-os/src/components/creative/KonvaCanvas.tsx && grep -q "from 'react-konva'" Z:/Cursor/visantlabs-os/src/components/creative/KonvaCanvas.tsx && grep -q "from 'use-image'" Z:/Cursor/visantlabs-os/src/components/creative/KonvaCanvas.tsx && grep -q "Transformer" Z:/Cursor/visantlabs-os/src/components/creative/KonvaCanvas.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File `src/components/creative/KonvaCanvas.tsx` exists.
    - File contains `forwardRef<Konva.Stage` (typed Stage ref forwarding).
    - File imports `Stage, Layer, Rect, Image as KonvaImage, Transformer` from `'react-konva'`.
    - File imports `useImage` default from `'use-image'`.
    - File contains a `useEffect` that reads `selectedLayerIds` and calls `trRef.current.nodes(...)`.
    - File contains a `useMemo` for the proxied background URL keyed on `backgroundUrl`
      (Pitfall 5 mitigation).
    - File renders `<LassoTool canvasWidth={width} canvasHeight={height} />` as a sibling
      of `<Stage>` inside the wrapper div.
    - File contains drag-drop handlers that call `addLayer` with the same three branches
      (`text`, `shape`, logo `url`) as the existing CreativeCanvas.tsx.
    - File contains the comment string `TODO(creative-konva-migration Wave 3)` flagging
      the placeholder Rect.
    - `CreativeCanvas.tsx` is UNCHANGED.
    - `CreativeMoveable.tsx` is UNCHANGED.
    - `creativeStore.ts` is UNCHANGED.
    - `npx tsc --noEmit` returns exit 0 (no new TS errors).
  </acceptance_criteria>
  <done>
    `KonvaCanvas.tsx` mounts as a working Stage shell: shows background image, overlay,
    placeholder rects per layer (with selection -> Transformer wiring), and hosts
    LassoTool unchanged. The component compiles and is ready for Wave 3 to swap
    placeholders for real layer components.
  </done>
</task>

</tasks>

<verification>
1. File exists: `test -f src/components/creative/KonvaCanvas.tsx`.
2. Type check passes: `npx tsc --noEmit` exit 0.
3. Required imports present: see grep checks in `<verify>`.
4. Old files untouched: `git diff --name-only HEAD` should NOT include CreativeCanvas.tsx
   or CreativeMoveable.tsx for this plan's commit.
5. Manual smoke (deferred to Wave 4): Stage renders bg + overlay + magenta
   placeholder rects when wired.
</verification>

<success_criteria>
- `KonvaCanvas` is a `forwardRef<Konva.Stage, Props>` component.
- Background image, gradient/solid overlay, and per-layer placeholder rects render
  inside one `<Stage>` / one `<Layer>`.
- Transformer is the LAST child of the Layer and updates via `useEffect` on
  `selectedLayerIds`.
- LassoTool is unchanged and rendered as a sibling DOM overlay.
- Drag-drop preserves the three add-layer branches (text/shape/logo) verbatim.
- Existing files (CreativeCanvas, CreativeMoveable, store) are not modified — Wave 4
  performs the swap and deletion.
</success_criteria>

<output>
After completion, create `.planning/phases/creative-konva-migration/02-SUMMARY.md` documenting:
- Public Props + ref type (`Konva.Stage`).
- The placeholder Rect approach + grep-able TODO marker for Wave 3.
- Confirmation that CreativeCanvas.tsx + CreativeMoveable.tsx are still in tree.
- The shapeRefs Map registration pattern (so Wave 3 knows the contract):
  `shapeRefs = useRef<Map<string, Konva.Node>>(new Map())` declared in KonvaCanvas.
  Wave 3 Task 4 will add a `registerNode` callback that mutates this Map — do NOT
  add `registerNode` in Wave 2. Layer components will call it to register/unregister
  themselves for Transformer attachment.
</output>
