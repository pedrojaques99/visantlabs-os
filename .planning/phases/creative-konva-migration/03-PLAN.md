---
phase: creative-konva-migration
plan: 03
type: execute
wave: 3
depends_on: [02]
files_modified:
  - src/components/creative/layers/KonvaTextLayer.tsx
  - src/components/creative/layers/KonvaLogoLayer.tsx
  - src/components/creative/layers/KonvaShapeLayer.tsx
  - src/components/creative/KonvaCanvas.tsx
autonomous: true
requirements:
  - KONVA-TEXT
  - KONVA-LOGO
  - KONVA-SHAPE
  - KONVA-LAYER-DISPATCH
must_haves:
  truths:
    - "Text layers render as Konva Text nodes; double-click opens a textarea overlay; commit on Enter/Escape/Blur writes content via updateLayer"
    - "Logo layers render as Konva Image via use-image with crossOrigin='anonymous'"
    - "Shape (rect) layers render as Konva Rect with fill color"
    - "Drag persists position; resize via Transformer persists size with scale RESET to 1 (Pitfall 1)"
    - "Each layer registers/unregisters its node in shapeRefs Map for Transformer attachment"
    - "Optional opacity / shadowColor / shadowBlur / shadowOffsetX / shadowOffsetY props from store flow into Konva node props"
    - "KonvaCanvas dispatches each layer.data.type to the correct Konva*Layer component"
  artifacts:
    - path: src/components/creative/layers/KonvaTextLayer.tsx
      provides: "Konva Text node + dblclick textarea editor + drag/transform persistence"
      min_lines: 80
      contains: "Text"
    - path: src/components/creative/layers/KonvaLogoLayer.tsx
      provides: "Konva Image via useImage('anonymous') + drag/transform persistence"
      min_lines: 50
      contains: "useImage"
    - path: src/components/creative/layers/KonvaShapeLayer.tsx
      provides: "Konva Rect + drag/transform persistence"
      min_lines: 50
      contains: "Rect"
    - path: src/components/creative/KonvaCanvas.tsx
      provides: "Layer dispatch swapped from placeholder to real Konva*Layer components"
      contains: "KonvaTextLayer"
  key_links:
    - from: "Konva*Layer"
      to: "shapeRefs Map (in KonvaCanvas)"
      via: "registerNode / unregisterNode callback prop"
      pattern: "registerNode|shapeRefs"
    - from: "Konva*Layer onTransformEnd"
      to: "updateLayer({ position, size })"
      via: "scaleX(1) reset + width*scaleX fold"
      pattern: "scaleX\\(1\\)"
    - from: "KonvaCanvas layer dispatch"
      to: "Konva*Layer components"
      via: "switch on layer.data.type"
      pattern: "data.type === 'text'"
    - from: "KonvaTextLayer dblclick"
      to: "DOM textarea overlay -> updateLayer({ content })"
      via: "absolute-positioned textarea"
      pattern: "textarea"
---

<objective>
Port the three concrete layer components to Konva and wire them into KonvaCanvas's
layer dispatch (replacing the magenta placeholder Rect from Wave 2).

Purpose: This is the visual core of the migration. After Wave 3, the Stage actually
shows the user's text, logos, and shapes — with selection, drag, and resize working
through the Konva Transformer.

NOTE: Component creation is explicitly approved as part of this migration phase per the
planning decision. `KonvaTextLayer.tsx`, `KonvaLogoLayer.tsx`, and `KonvaShapeLayer.tsx`
are new files introduced by this migration — they do not violate the "no new UI
components without permission" rule in CLAUDE.md.

Output:
- 3 NEW files: `KonvaTextLayer.tsx`, `KonvaLogoLayer.tsx`, `KonvaShapeLayer.tsx`.
- 1 MODIFIED file: `KonvaCanvas.tsx` — replace placeholder Rect with type-dispatched
  layer components and expose a `registerNode` callback so each layer plugs into
  `shapeRefs` for Transformer attachment.

Why one plan (not three): the three layers SHARE the registerNode contract and the
KonvaCanvas dispatch — splitting them into 3 plans creates a circular wire-up problem
and forces 3 round trips through KonvaCanvas. Three small files + one wire change in
the same plan stays comfortably under the 50% context budget (each layer ≈ 60 lines).
Group layer dispatch is OUT OF SCOPE — keep current group fallback (skip rendering or
pass through children) per existing CreativeCanvas behavior.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/creative-konva-migration/RESEARCH.md
@src/components/creative/KonvaCanvas.tsx
@src/components/creative/layers/TextLayer.tsx
@src/components/creative/layers/LogoLayer.tsx
@src/components/creative/layers/ShapeLayer.tsx
@src/components/creative/store/creativeStore.ts
@src/components/creative/store/creativeTypes.ts
@src/components/creative/lib/parseAccent.ts
@src/lib/pixel.ts
@src/utils/proxyUtils.ts

<interfaces>
<!-- Shared layer component contract -->

```typescript
// Common props shape for all three Konva*Layer components
interface KonvaLayerProps<TData> {
  layer: { id: string; visible: boolean; zIndex: number; data: TData };
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string, extend: boolean) => void;
}

// Specific:
type KonvaTextLayerProps  = KonvaLayerProps<TextLayerData>  & { accentColor: string };
type KonvaLogoLayerProps  = KonvaLayerProps<LogoLayerData>;
type KonvaShapeLayerProps = KonvaLayerProps<ShapeLayerData>;
```

<!-- Already in KonvaCanvas (from Wave 2) -->
```typescript
const shapeRefs = useRef<Map<string, Konva.Node>>(new Map());
const trRef = useRef<Konva.Transformer>(null);
// useEffect attaches Transformer based on selectedLayerIds (already wired in Wave 2)
```

<!-- Store actions used (read-only contract — no store changes) -->
- `updateLayer(id: string, updates: Partial<CreativeLayerData>): void`
  - For text edit: `{ content: string }`
  - For move/resize: `{ position: {x,y}, size: {w,h} }` (normalized 0-1)

<!-- pixel.ts helpers used -->
```typescript
import { normalizePoint, normalizeSize } from '@/lib/pixel';
// normalize{Point,Size}(absolutePx, { w: canvasWidth, h: canvasHeight }) -> 0-1
```

<!-- Type fields added in Wave 1 (Plan 01) — read at render time -->
```typescript
opacity?: number;            // pass to Konva node `opacity` (default 1)
shadowColor?: string;        // pass to Konva node `shadowColor`
shadowBlur?: number;         // pass to Konva node `shadowBlur` (default 0)
shadowOffsetX?: number;      // pass to Konva node `shadowOffsetX` (default 0)
shadowOffsetY?: number;      // pass to Konva node `shadowOffsetY` (default 0)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create KonvaShapeLayer.tsx (simplest — reference for the others)</name>
  <files>src/components/creative/layers/KonvaShapeLayer.tsx</files>
  <read_first>
    - Z:/Cursor/visantlabs-os/src/components/creative/layers/ShapeLayer.tsx (the DOM version we're replacing)
    - Z:/Cursor/visantlabs-os/.planning/phases/creative-konva-migration/RESEARCH.md (Pattern 1: scale reset; Pitfall 1: scale persists; Code Examples > KonvaShapeLayer)
    - Z:/Cursor/visantlabs-os/src/lib/pixel.ts (normalizePoint, normalizeSize signatures)
    - Z:/Cursor/visantlabs-os/src/components/creative/store/creativeStore.ts (lines 219-240, updateLayer signature)

    NOTE on registerNode timing: `registerNode` is a prop that KonvaCanvas will supply.
    In Tasks 1-3 of this plan, declare `registerNode: (id: string, node: Konva.Node | null) => void`
    in the Props interface of each layer component. The actual implementation of
    `registerNode` in `KonvaCanvas.tsx` is added in Task 4 of this same plan. This
    means the layer components compile with the prop type declared, but callers (other
    than KonvaCanvas after Task 4) will not type-check until Task 4 patches KonvaCanvas
    to supply the callback. Do NOT attempt to import or inline registerNode logic here —
    it is provided as a prop from the parent.
  </read_first>
  <action>
    Create `src/components/creative/layers/KonvaShapeLayer.tsx`. Use the verified
    pattern from RESEARCH.md "Code Examples > KonvaShapeLayer" as the spine. Key
    requirements:

    ```typescript
    import React, { useRef, useEffect } from 'react';
    import { Rect } from 'react-konva';
    import Konva from 'konva';
    import { useCreativeStore } from '../store/creativeStore';
    import { normalizePoint, normalizeSize } from '@/lib/pixel';
    import type { CreativeLayer, ShapeLayerData } from '../store/creativeTypes';

    interface Props {
      layer: CreativeLayer & { data: ShapeLayerData };
      canvasWidth: number;
      canvasHeight: number;
      isSelected: boolean;
      registerNode: (id: string, node: Konva.Node | null) => void;
      onSelect: (id: string, extend: boolean) => void;
    }

    export const KonvaShapeLayer: React.FC<Props> = ({
      layer, canvasWidth, canvasHeight, isSelected, registerNode, onSelect,
    }) => {
      const updateLayer = useCreativeStore((s) => s.updateLayer);
      const shapeRef = useRef<Konva.Rect>(null);
      const { data } = layer;

      // Register on mount, unregister on unmount/id-change
      useEffect(() => {
        registerNode(layer.id, shapeRef.current);
        return () => registerNode(layer.id, null);
      }, [layer.id, registerNode]);

      return (
        <Rect
          ref={shapeRef}
          x={data.position.x * canvasWidth}
          y={data.position.y * canvasHeight}
          width={data.size.w * canvasWidth}
          height={data.size.h * canvasHeight}
          fill={data.color}
          opacity={data.opacity ?? 1}
          shadowColor={data.shadowColor}
          shadowBlur={data.shadowBlur ?? 0}
          shadowOffsetX={data.shadowOffsetX ?? 0}
          shadowOffsetY={data.shadowOffsetY ?? 0}
          draggable
          onClick={(e) => onSelect(layer.id, e.evt.shiftKey)}
          onTap={(e) => onSelect(layer.id, e.evt.shiftKey)}
          onDragEnd={(e) => {
            updateLayer(layer.id, {
              position: normalizePoint(
                { x: e.target.x(), y: e.target.y() },
                { w: canvasWidth, h: canvasHeight }
              ),
            });
          }}
          onTransformEnd={() => {
            const node = shapeRef.current!;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            // CRITICAL: reset scale to 1 and fold into width/height (Pitfall 1)
            node.scaleX(1);
            node.scaleY(1);
            updateLayer(layer.id, {
              position: normalizePoint(
                { x: node.x(), y: node.y() },
                { w: canvasWidth, h: canvasHeight }
              ),
              size: normalizeSize(
                { w: Math.max(1, node.width() * scaleX), h: Math.max(1, node.height() * scaleY) },
                { w: canvasWidth, h: canvasHeight }
              ),
            });
          }}
        />
      );
    };
    ```

    Notes:
    - `Math.max(1, ...)` prevents Transformer from collapsing to 0 (defensive).
    - `data.shadowColor` is `undefined` when not set — Konva treats undefined shadowColor
      as no shadow, so passing it through is safe.
    - `data.opacity ?? 1` — undefined means fully opaque.
    - The `isSelected` prop is currently unused for Shape — keep it in the contract for
      symmetry with Text (which uses it later if needed). Lint may flag it; suppress
      with `void isSelected;` if your project's eslint flags unused destructured props.

    DO NOT:
    - Persist scaleX / scaleY in the store.
    - Add rotation handling (out of scope; Transformer has rotateEnabled=false in Wave 2).
    - Touch CreativeCanvas.tsx, CreativeMoveable.tsx, or the original ShapeLayer.tsx.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p Z:/Cursor/visantlabs-os && grep -q "scaleX(1)" Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaShapeLayer.tsx && grep -q "registerNode(layer.id" Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaShapeLayer.tsx && grep -q "from 'react-konva'" Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaShapeLayer.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `src/components/creative/layers/KonvaShapeLayer.tsx`.
    - Imports `Rect` from `'react-konva'`, `Konva` from `'konva'`.
    - Calls `registerNode(layer.id, shapeRef.current)` in a useEffect.
    - Cleans up by calling `registerNode(layer.id, null)` on unmount.
    - `onTransformEnd` resets `scaleX(1)` and `scaleY(1)` BEFORE reading width/height.
    - `onTransformEnd` calls `updateLayer` with both `position` and `size` (normalized).
    - `onDragEnd` calls `updateLayer` with `position` only (normalized).
    - Forwards `data.opacity`, `data.shadowColor`, `data.shadowBlur`,
      `data.shadowOffsetX`, `data.shadowOffsetY` to the Konva Rect.
    - Does NOT touch `ShapeLayer.tsx` (the DOM version).
    - `npx tsc --noEmit` exit 0.
  </acceptance_criteria>
  <done>
    Konva Rect layer that drags, resizes (with proper scale reset), persists changes
    to the Zustand store, registers itself with the parent Transformer map, and
    forwards optional opacity/shadow props.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create KonvaLogoLayer.tsx (Konva Image via use-image)</name>
  <files>src/components/creative/layers/KonvaLogoLayer.tsx</files>
  <read_first>
    - Z:/Cursor/visantlabs-os/src/components/creative/layers/LogoLayer.tsx (DOM version)
    - Z:/Cursor/visantlabs-os/.planning/phases/creative-konva-migration/RESEARCH.md (Pattern 4: Image Loading via use-image; Pitfall 2: tainted canvas; Pitfall 5: useImage memo)
    - Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaShapeLayer.tsx (created in Task 1 — same drag/transform spine)
    - Z:/Cursor/visantlabs-os/src/utils/proxyUtils.ts (getProxiedUrl signature)
  </read_first>
  <action>
    Create `src/components/creative/layers/KonvaLogoLayer.tsx`. Reuse the drag/transform
    spine from KonvaShapeLayer. Key differences:

    ```typescript
    import React, { useRef, useEffect, useMemo } from 'react';
    import { Image as KonvaImage } from 'react-konva';
    import useImage from 'use-image';
    import Konva from 'konva';
    import { useCreativeStore } from '../store/creativeStore';
    import { normalizePoint, normalizeSize } from '@/lib/pixel';
    import { getProxiedUrl } from '@/utils/proxyUtils';
    import type { CreativeLayer, LogoLayerData } from '../store/creativeTypes';

    interface Props {
      layer: CreativeLayer & { data: LogoLayerData };
      canvasWidth: number;
      canvasHeight: number;
      isSelected: boolean;
      registerNode: (id: string, node: Konva.Node | null) => void;
      onSelect: (id: string, extend: boolean) => void;
    }

    export const KonvaLogoLayer: React.FC<Props> = ({
      layer, canvasWidth, canvasHeight, isSelected, registerNode, onSelect,
    }) => {
      const updateLayer = useCreativeStore((s) => s.updateLayer);
      const shapeRef = useRef<Konva.Image>(null);
      const { data } = layer;

      // Memoize proxied URL — Pitfall 5: getProxiedUrl returns a new string per render
      const proxiedUrl = useMemo(() => getProxiedUrl(data.url), [data.url]);
      // 'anonymous' REQUIRED for stage.toDataURL export (Pitfall 2)
      const [image, status] = useImage(proxiedUrl, 'anonymous');

      useEffect(() => {
        registerNode(layer.id, shapeRef.current);
        return () => registerNode(layer.id, null);
      }, [layer.id, registerNode]);

      return (
        <KonvaImage
          ref={shapeRef}
          image={image}
          x={data.position.x * canvasWidth}
          y={data.position.y * canvasHeight}
          width={data.size.w * canvasWidth}
          height={data.size.h * canvasHeight}
          opacity={data.opacity ?? 1}
          shadowColor={data.shadowColor}
          shadowBlur={data.shadowBlur ?? 0}
          shadowOffsetX={data.shadowOffsetX ?? 0}
          shadowOffsetY={data.shadowOffsetY ?? 0}
          draggable
          onClick={(e) => onSelect(layer.id, e.evt.shiftKey)}
          onTap={(e) => onSelect(layer.id, e.evt.shiftKey)}
          onDragEnd={(e) => {
            updateLayer(layer.id, {
              position: normalizePoint(
                { x: e.target.x(), y: e.target.y() },
                { w: canvasWidth, h: canvasHeight }
              ),
            });
          }}
          onTransformEnd={() => {
            const node = shapeRef.current!;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            updateLayer(layer.id, {
              position: normalizePoint(
                { x: node.x(), y: node.y() },
                { w: canvasWidth, h: canvasHeight }
              ),
              size: normalizeSize(
                { w: Math.max(1, node.width() * scaleX), h: Math.max(1, node.height() * scaleY) },
                { w: canvasWidth, h: canvasHeight }
              ),
            });
          }}
        />
      );
    };
    ```

    Notes:
    - When `image` is undefined (still loading), Konva renders nothing — no crash.
    - The current DOM LogoLayer shows a red dashed outline on `onError`. Skip that in
      Konva v1; `useImage`'s `status === 'failed'` is observable but the visual fallback
      is a follow-up enhancement (out of scope).
    - `objectFit: contain` from the DOM version is replaced by explicit `width`/`height`
      on the Konva Image — Konva stretches to those dimensions. The Transformer
      `keepRatio={false}` (Wave 2 setting) lets the user squish the logo, matching the
      current behavior.
    - `crossOrigin='anonymous'` is mandatory for export (Pitfall 2).

    DO NOT:
    - Forget to memoize `proxiedUrl` (Pitfall 5 → infinite loop).
    - Touch the DOM `LogoLayer.tsx`.
    - Add filters / `.cache()` calls.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p Z:/Cursor/visantlabs-os && grep -q "useImage(proxiedUrl, 'anonymous')" Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaLogoLayer.tsx && grep -q "useMemo(() => getProxiedUrl" Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaLogoLayer.tsx && grep -q "scaleX(1)" Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaLogoLayer.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `src/components/creative/layers/KonvaLogoLayer.tsx`.
    - Imports `Image as KonvaImage` from `'react-konva'` and `useImage` default from `'use-image'`.
    - Memoizes `getProxiedUrl(data.url)` via `useMemo` keyed on `data.url`.
    - Calls `useImage(proxiedUrl, 'anonymous')` (CORS-safe).
    - Same registerNode useEffect contract as KonvaShapeLayer.
    - `onTransformEnd` performs the scale-reset → fold-into-width/height pattern.
    - Forwards opacity / shadow* props.
    - Does NOT modify `LogoLayer.tsx` (DOM version).
    - `npx tsc --noEmit` exit 0.
  </acceptance_criteria>
  <done>
    Konva Image layer that loads via use-image with anonymous CORS, drags, resizes
    correctly, registers with the parent Transformer map, and exports cleanly later.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create KonvaTextLayer.tsx (Konva Text + textarea overlay editor)</name>
  <files>src/components/creative/layers/KonvaTextLayer.tsx</files>
  <read_first>
    - Z:/Cursor/visantlabs-os/src/components/creative/layers/TextLayer.tsx (DOM version — copy fontSize scaling formula)
    - Z:/Cursor/visantlabs-os/.planning/phases/creative-konva-migration/RESEARCH.md (Pattern 3: textarea overlay; section "TextLayerData: accent color handling")
    - Z:/Cursor/visantlabs-os/src/components/creative/lib/parseAccent.ts (stripAccent)
    - Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaShapeLayer.tsx (drag/transform spine)
  </read_first>
  <action>
    Create `src/components/creative/layers/KonvaTextLayer.tsx`. This is the most complex
    layer because Konva Text is not editable — we use the DOM textarea overlay pattern
    from RESEARCH.md Pattern 3 (verbatim from konvajs.org/docs/sandbox/Editable_Text.html).

    Skeleton:

    ```typescript
    import React, { useRef, useEffect, useState } from 'react';
    import { Text } from 'react-konva';
    import Konva from 'konva';
    import { useCreativeStore } from '../store/creativeStore';
    import { stripAccent } from '../lib/parseAccent';
    import { normalizePoint, normalizeSize } from '@/lib/pixel';
    import type { CreativeLayer, TextLayerData } from '../store/creativeTypes';

    interface Props {
      layer: CreativeLayer & { data: TextLayerData };
      canvasWidth: number;
      canvasHeight: number;
      isSelected: boolean;
      accentColor: string;          // unused for now — accent rendering deferred
      registerNode: (id: string, node: Konva.Node | null) => void;
      onSelect: (id: string, extend: boolean) => void;
    }

    export const KonvaTextLayer: React.FC<Props> = ({
      layer, canvasWidth, canvasHeight, isSelected, accentColor,
      registerNode, onSelect,
    }) => {
      const updateLayer = useCreativeStore((s) => s.updateLayer);
      const shapeRef = useRef<Konva.Text>(null);
      const trRef = useRef<HTMLTextAreaElement | null>(null);
      const [isEditing, setIsEditing] = useState(false);
      const { data } = layer;

      // fontSize stored at 1080px reference — same scaling rule as DOM TextLayer.tsx
      const scaledFontSize = (data.fontSize / 1080) * canvasHeight;
      const displayText = stripAccent(data.content); // accent rendering deferred

      useEffect(() => {
        registerNode(layer.id, shapeRef.current);
        return () => registerNode(layer.id, null);
      }, [layer.id, registerNode]);

      const handleDblClick = () => {
        const textNode = shapeRef.current;
        if (!textNode) return;
        const stage = textNode.getStage();
        if (!stage) return;

        const stageBox = stage.container().getBoundingClientRect();
        const absPos = textNode.absolutePosition();

        textNode.hide();
        setIsEditing(true);

        const ta = document.createElement('textarea');
        document.body.appendChild(ta);
        trRef.current = ta;

        ta.value = displayText;
        ta.style.position = 'absolute';
        ta.style.top = `${stageBox.top + absPos.y + window.scrollY}px`;
        ta.style.left = `${stageBox.left + absPos.x + window.scrollX}px`;
        ta.style.width = `${textNode.width() - textNode.padding() * 2}px`;
        ta.style.height = `${textNode.height() - textNode.padding() * 2 + 5}px`;
        ta.style.fontSize = `${scaledFontSize}px`;
        ta.style.fontFamily = data.fontFamily;
        ta.style.fontWeight = data.bold ? '700' : '400';
        ta.style.color = data.color;
        ta.style.background = 'transparent';
        ta.style.border = '1px solid rgba(0,229,255,0.4)';
        ta.style.padding = '0';
        ta.style.margin = '0';
        ta.style.overflow = 'hidden';
        ta.style.outline = 'none';
        ta.style.resize = 'none';
        ta.style.lineHeight = '1.05';
        ta.style.textAlign = data.align;
        ta.style.zIndex = '9999';
        ta.style.transformOrigin = 'left top';
        ta.focus();
        ta.select();

        const commit = (cancel = false) => {
          if (trRef.current !== ta) return; // already cleaned up
          if (!cancel) {
            updateLayer(layer.id, { content: ta.value } as Partial<TextLayerData>);
          }
          ta.removeEventListener('keydown', onKeyDown);
          ta.removeEventListener('blur', onBlur);
          if (ta.parentNode) ta.parentNode.removeChild(ta);
          trRef.current = null;
          textNode.show();
          setIsEditing(false);
          textNode.getLayer()?.batchDraw();
        };

        const onKeyDown = (ev: KeyboardEvent) => {
          if (ev.key === 'Escape') { ev.preventDefault(); commit(true); }
          else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(false); }
        };
        const onBlur = () => commit(false);

        ta.addEventListener('keydown', onKeyDown);
        ta.addEventListener('blur', onBlur);
      };

      // Cleanup textarea if component unmounts mid-edit
      useEffect(() => {
        return () => {
          if (trRef.current && trRef.current.parentNode) {
            trRef.current.parentNode.removeChild(trRef.current);
            trRef.current = null;
          }
        };
      }, []);

      return (
        <Text
          ref={shapeRef}
          text={displayText}
          x={data.position.x * canvasWidth}
          y={data.position.y * canvasHeight}
          width={data.size.w * canvasWidth}
          height={data.size.h * canvasHeight}
          fontSize={scaledFontSize}
          fontFamily={data.fontFamily}
          fontStyle={data.bold ? 'bold' : 'normal'}
          fill={data.color}
          align={data.align}
          lineHeight={1.05}
          opacity={data.opacity ?? 1}
          shadowColor={data.shadowColor}
          shadowBlur={data.shadowBlur ?? 0}
          shadowOffsetX={data.shadowOffsetX ?? 0}
          shadowOffsetY={data.shadowOffsetY ?? 0}
          draggable
          onClick={(e) => onSelect(layer.id, e.evt.shiftKey)}
          onTap={(e) => onSelect(layer.id, e.evt.shiftKey)}
          onDblClick={handleDblClick}
          onDblTap={handleDblClick}
          onDragEnd={(e) => {
            updateLayer(layer.id, {
              position: normalizePoint(
                { x: e.target.x(), y: e.target.y() },
                { w: canvasWidth, h: canvasHeight }
              ),
            });
          }}
          onTransformEnd={() => {
            const node = shapeRef.current!;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            updateLayer(layer.id, {
              position: normalizePoint(
                { x: node.x(), y: node.y() },
                { w: canvasWidth, h: canvasHeight }
              ),
              size: normalizeSize(
                { w: Math.max(20, node.width() * scaleX), h: Math.max(20, node.height() * scaleY) },
                { w: canvasWidth, h: canvasHeight }
              ),
            });
          }}
        />
      );
    };
    ```

    Notes:
    - Accent rendering is DEFERRED per RESEARCH "TextLayerData: accent color handling".
      We render `stripAccent(data.content)`. The store still preserves the original
      markup. `accentColor` prop is accepted for future use; suppress unused-warning
      if needed: `void accentColor;`.
    - `fontStyle` in Konva accepts `"normal" | "bold" | "italic" | "italic bold"`.
    - `Math.max(20, ...)` on text resize is defensive against accidental zero-size.
    - The cleanup useEffect handles the case where the user navigates away mid-edit.
    - Do NOT use `react-konva-utils <Html>` — research says it's an alternative but
      adds a dependency; the manual DOM approach is the recommendation.

    DO NOT:
    - Render `parseAccent()` JSX inside Konva Text — it doesn't accept ReactNode.
    - Touch the DOM `TextLayer.tsx`.
    - Persist scaleX/scaleY.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p Z:/Cursor/visantlabs-os && grep -q "document.createElement('textarea')" Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaTextLayer.tsx && grep -q "stripAccent" Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaTextLayer.tsx && grep -q "scaleX(1)" Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaTextLayer.tsx && grep -q "registerNode(layer.id" Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaTextLayer.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `src/components/creative/layers/KonvaTextLayer.tsx`.
    - Imports `Text` from `'react-konva'` and `stripAccent` from `'../lib/parseAccent'`.
    - Renders Konva `<Text>` with `text={stripAccent(data.content)}` (NOT parseAccent JSX).
    - On double-click: hides Konva Text, creates DOM textarea, commits on Enter/Escape/Blur.
    - On commit, calls `updateLayer(layer.id, { content })`.
    - Has cleanup `useEffect` that removes the textarea if component unmounts mid-edit.
    - Same registerNode useEffect contract.
    - Same scale-reset transform pattern.
    - Forwards opacity / shadow* props.
    - Forwards `accentColor` prop in the type but does not use it (deferred per scope).
    - Does NOT modify `TextLayer.tsx` (DOM version).
    - `npx tsc --noEmit` exit 0.
  </acceptance_criteria>
  <done>
    Konva Text layer with double-click textarea editing, drag, transform (scale-reset),
    and store persistence. Accent rendering intentionally deferred — text shows
    `stripAccent(content)`.
  </done>
</task>

<task type="auto">
  <name>Task 4: Wire Konva*Layer dispatch into KonvaCanvas, replacing placeholder</name>
  <files>src/components/creative/KonvaCanvas.tsx</files>
  <read_first>
    - Z:/Cursor/visantlabs-os/src/components/creative/KonvaCanvas.tsx (current state from Wave 2)
    - Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaTextLayer.tsx (just created)
    - Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaLogoLayer.tsx (just created)
    - Z:/Cursor/visantlabs-os/src/components/creative/layers/KonvaShapeLayer.tsx (just created)
  </read_first>
  <action>
    Modify the existing `KonvaCanvas.tsx` (built in Wave 2) to:

    1. Import the three new Konva layer components:
       ```typescript
       import { KonvaTextLayer } from './layers/KonvaTextLayer';
       import { KonvaLogoLayer } from './layers/KonvaLogoLayer';
       import { KonvaShapeLayer } from './layers/KonvaShapeLayer';
       ```

    2. Define a stable `registerNode` callback that mutates the existing
       `shapeRefs` Map (already declared in Wave 2):
       ```typescript
       const registerNode = useCallback((id: string, node: Konva.Node | null) => {
         if (node) shapeRefs.current.set(id, node);
         else shapeRefs.current.delete(id);
       }, []);
       ```
       (Add `useCallback` to the React imports.)

    3. Define a stable `handleSelect` callback that defers to the store:
       ```typescript
       const handleSelect = useCallback((id: string, extend: boolean) => {
         setSelectedLayerIds([id], extend);
       }, [setSelectedLayerIds]);
       ```

    4. Replace the placeholder `Rect` block (the magenta one with the
       `TODO(creative-konva-migration Wave 3)` comment) with a type dispatch:

       ```typescript
       {layers.filter(l => l.visible).map((layer) => {
         const common = {
           canvasWidth: width,
           canvasHeight: height,
           isSelected: selectedLayerIds.includes(layer.id),
           registerNode,
           onSelect: handleSelect,
         };
         if (layer.data.type === 'text') {
           return (
             <KonvaTextLayer
               key={layer.id}
               layer={layer as any}
               accentColor={accentColor}
               {...common}
             />
           );
         }
         if (layer.data.type === 'logo') {
           return <KonvaLogoLayer key={layer.id} layer={layer as any} {...common} />;
         }
         if (layer.data.type === 'shape') {
           return <KonvaShapeLayer key={layer.id} layer={layer as any} {...common} />;
         }
         // 'group' — out of scope for this phase, skip render (current DOM version
         // also has no top-level group rendering — children are tracked separately)
         return null;
       })}
       ```

       Use `as any` on `layer` — the discriminated-union narrowing across child
       components is awkward; an `as any` cast inside the dispatch is acceptable and
       matches the pattern in the current `CreativeCanvas.tsx` (which also uses
       `layer as any`).

    5. REMOVE the placeholder Rect block AND its `TODO(creative-konva-migration Wave 3)`
       comment.

    DO NOT:
    - Touch the existing Stage / Layer / Background / Overlay / Transformer / Drag-drop
      / LassoTool wiring from Wave 2.
    - Touch the original DOM `CreativeCanvas.tsx` — it is still the active canvas until
      Wave 4 swaps it.
    - Add Group rendering — out of scope.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p Z:/Cursor/visantlabs-os && grep -q "KonvaTextLayer" Z:/Cursor/visantlabs-os/src/components/creative/KonvaCanvas.tsx && grep -q "KonvaLogoLayer" Z:/Cursor/visantlabs-os/src/components/creative/KonvaCanvas.tsx && grep -q "KonvaShapeLayer" Z:/Cursor/visantlabs-os/src/components/creative/KonvaCanvas.tsx && ! grep -q "TODO(creative-konva-migration Wave 3)" Z:/Cursor/visantlabs-os/src/components/creative/KonvaCanvas.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `KonvaCanvas.tsx` imports `KonvaTextLayer`, `KonvaLogoLayer`, `KonvaShapeLayer`.
    - `registerNode` and `handleSelect` callbacks are wrapped in `useCallback`.
    - The dispatch returns the correct component for each `layer.data.type` value.
    - Placeholder Rect block (magenta `rgba(255,0,255,...)`) is removed.
    - `TODO(creative-konva-migration Wave 3)` comment is removed.
    - Stage / Layer / Background / Overlay / Transformer / LassoTool from Wave 2 are
      still present.
    - The original `CreativeCanvas.tsx` is unchanged.
    - `npx tsc --noEmit` exit 0.
  </acceptance_criteria>
  <done>
    KonvaCanvas now renders real layers via the three Konva*Layer components with full
    drag / select / transform / edit support. The Stage is functionally complete and
    ready for Wave 4 to wire it into CreativeStudio + replace the export pipeline.
  </done>
</task>

</tasks>

<verification>
1. Three layer files exist:
   - `test -f src/components/creative/layers/KonvaTextLayer.tsx`
   - `test -f src/components/creative/layers/KonvaLogoLayer.tsx`
   - `test -f src/components/creative/layers/KonvaShapeLayer.tsx`
2. `npx tsc --noEmit` returns exit 0 from project root.
3. Each Konva*Layer file contains `scaleX(1)` (Pitfall 1 mitigation).
4. KonvaCanvas dispatch is wired (the four imports appear in the file).
5. Placeholder Rect TODO comment is gone from KonvaCanvas.
6. DOM TextLayer / LogoLayer / ShapeLayer are unchanged on disk
   (`git diff` shows no changes to those three files).
</verification>

<success_criteria>
- `KonvaTextLayer.tsx`, `KonvaLogoLayer.tsx`, `KonvaShapeLayer.tsx` exist and compile.
- All three implement the same registerNode + onSelect + onDragEnd + onTransformEnd
  contract.
- All three forward optional opacity / shadow* props from the layer data.
- `KonvaCanvas.tsx` dispatches by `layer.data.type` to the correct component.
- DOM versions (`TextLayer.tsx`, `LogoLayer.tsx`, `ShapeLayer.tsx`) are untouched —
  Wave 4 will delete them.
- Type checker passes; the app still runs (CreativeCanvas is still wired in
  CreativeStudio — Wave 4 swaps it).
</success_criteria>

<output>
After completion, create `.planning/phases/creative-konva-migration/03-SUMMARY.md` documenting:
- Each layer component's external contract (Props type) — Wave 4 needs to know.
- Confirmation that all three layers use the scale-reset pattern.
- Confirmation that DOM layer files are still on disk (Wave 4 deletes them).
- Note that accent color rendering is deferred (text shows stripAccent).
</output>
