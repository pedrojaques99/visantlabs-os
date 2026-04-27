---
phase: creative-konva-migration
plan: "03"
subsystem: creative-editor
tags: [konva, layers, text, logo, shape, transformer, drag, resize]
dependency_graph:
  requires: [01, 02]
  provides: [KonvaTextLayer, KonvaLogoLayer, KonvaShapeLayer, KonvaCanvas-layer-dispatch]
  affects:
    - src/components/creative/layers/KonvaTextLayer.tsx
    - src/components/creative/layers/KonvaLogoLayer.tsx
    - src/components/creative/layers/KonvaShapeLayer.tsx
    - src/components/creative/KonvaCanvas.tsx
tech_stack:
  added: []
  patterns:
    - scale-reset-on-transform (Pitfall 1 — fold scaleX/scaleY into width/height before persisting)
    - registerNode-Map-registration (layers self-register via prop callback into shapeRefs)
    - useImage-anonymous-cors (crossOrigin='anonymous' for export-safe canvas)
    - dom-textarea-overlay-editor (Konva Text + DOM textarea for double-click editing)
    - stripAccent-deferred-rendering (accent markup preserved in store, stripped for Konva display)
key_files:
  created:
    - src/components/creative/layers/KonvaShapeLayer.tsx
    - src/components/creative/layers/KonvaLogoLayer.tsx
    - src/components/creative/layers/KonvaTextLayer.tsx
  modified:
    - src/components/creative/KonvaCanvas.tsx
decisions:
  - "Accent rendering deferred — KonvaTextLayer renders stripAccent(content); store preserves original markup for Wave 5"
  - "Logo image-load error fallback deferred — useImage status='failed' observable but visual fallback is out of scope"
  - "Group layers return null — CreativeCanvas.tsx also has no top-level group rendering; Wave 4+ can revisit"
  - "as any cast used in KonvaCanvas dispatch — discriminated-union narrowing across child components; matches existing CreativeCanvas.tsx pattern"
metrics:
  duration: "~14 minutes"
  completed: "2026-04-27"
  tasks: 4
  files: 4
---

# Phase creative-konva-migration Plan 03: Konva Layer Components Summary

**One-liner:** Ported text, logo, and shape layers to three Konva*Layer components with drag/transform/scale-reset, wired them into KonvaCanvas replacing the magenta placeholder Rect.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create KonvaShapeLayer.tsx | f4271d5 | src/components/creative/layers/KonvaShapeLayer.tsx |
| 2 | Create KonvaLogoLayer.tsx | fbc80a7 | src/components/creative/layers/KonvaLogoLayer.tsx |
| 3 | Create KonvaTextLayer.tsx | 117689a | src/components/creative/layers/KonvaTextLayer.tsx |
| 4 | Wire dispatch into KonvaCanvas | 3bafb2f | src/components/creative/KonvaCanvas.tsx |

## Public Contract — Wave 4

All three layers share this prop contract:

```typescript
interface KonvaLayerProps<TData> {
  layer: CreativeLayer & { data: TData };
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string, extend: boolean) => void;
}

// KonvaTextLayer additionally requires:
accentColor: string; // accepted, not yet used — deferred
```

## Scale-Reset Pattern Confirmation

All three Konva*Layer components implement the required pattern in `onTransformEnd`:

```typescript
const scaleX = node.scaleX();
const scaleY = node.scaleY();
node.scaleX(1); // CRITICAL: reset before reading width/height
node.scaleY(1);
updateLayer(layer.id, {
  size: normalizeSize(
    { w: Math.max(N, node.width() * scaleX), h: Math.max(N, node.height() * scaleY) },
    { w: canvasWidth, h: canvasHeight }
  ),
});
```

Min-size guards: `Math.max(1, ...)` for Shape/Logo, `Math.max(20, ...)` for Text.

## DOM Layer Files Confirmation

The following files were NOT modified (confirmed via `git diff` — 0 diff lines):

- `src/components/creative/layers/TextLayer.tsx` — UNCHANGED
- `src/components/creative/layers/LogoLayer.tsx` — UNCHANGED
- `src/components/creative/layers/ShapeLayer.tsx` — UNCHANGED

Wave 4 will delete these when CreativeCanvas.tsx is swapped out.

## Accent Color Note

`KonvaTextLayer` renders `stripAccent(data.content)` — the `<accent>...</accent>` markup is
stripped for display. The original markup is preserved in the Zustand store. The `accentColor`
prop is accepted but suppressed with `void accentColor`. Full accent rendering requires a
multi-span workaround (deferred to a later wave).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/components/creative/layers/KonvaTextLayer.tsx` exists: VERIFIED
- `src/components/creative/layers/KonvaLogoLayer.tsx` exists: VERIFIED
- `src/components/creative/layers/KonvaShapeLayer.tsx` exists: VERIFIED
- All three contain `scaleX(1)`: VERIFIED
- KonvaCanvas contains KonvaTextLayer import: VERIFIED
- KonvaCanvas contains KonvaLogoLayer import: VERIFIED
- KonvaCanvas contains KonvaShapeLayer import: VERIFIED
- Placeholder magenta Rect removed: VERIFIED
- TODO comment removed: VERIFIED
- DOM TextLayer/LogoLayer/ShapeLayer unchanged: VERIFIED (0 git diff lines)
- TypeScript noEmit: 0 errors in new files (pre-existing errors in plugin/ and tests/ unrelated)
- All 4 commits exist: f4271d5, fbc80a7, 117689a, 3bafb2f
