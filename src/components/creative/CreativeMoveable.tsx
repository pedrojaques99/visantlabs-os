import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Moveable from "react-moveable";
import Selecto from "react-selecto";
import { useCreativeStore } from "./store/creativeStore";
import { normalizePoint, normalizeSize } from "@/lib/pixel";

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const CreativeMoveable: React.FC<Props> = ({
  canvasWidth,
  canvasHeight,
  containerRef,
}) => {
  const { layers, selectedLayerIds, setSelectedLayerIds, updateLayer } =
    useCreativeStore();

  const moveableRef = useRef<Moveable>(null);
  const selectoRef = useRef<Selecto>(null);
  const [targets, setTargets] = useState<Array<HTMLElement | SVGElement>>([]);
  // Keep a ref in sync so Selecto closures always see current targets
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  // Sync DOM targets with store selection
  useEffect(() => {
    if (!containerRef.current) return;
    const next = selectedLayerIds
      .map((id) => containerRef.current!.querySelector(`[data-layer-id="${id}"]`))
      .filter(Boolean) as Array<HTMLElement | SVGElement>;
    setTargets(next);
  }, [selectedLayerIds, layers, containerRef]);

  // Stable dep for elementGuidelines — only recompute when layer IDs or selection change
  const layerIdKey = useMemo(
    () => layers.map((l) => l.id).join(","),
    [layers]
  );
  const selectedKey = useMemo(
    () => selectedLayerIds.join(","),
    [selectedLayerIds]
  );

  const elementGuidelines = useMemo(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(".creative-layer")
    ).filter((el) => {
      const id = el.getAttribute("data-layer-id");
      return id && !selectedLayerIds.includes(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerIdKey, selectedKey, containerRef]);

  // Refresh handles when canvas dimensions change
  useEffect(() => {
    moveableRef.current?.updateRect();
  }, [canvasWidth, canvasHeight]);

  // Helper: commit from Moveable event data directly (no DOM reads)
  const commit = useCallback(
    (target: HTMLElement, left: number, top: number, width: number, height: number) => {
      const id = target.getAttribute("data-layer-id");
      if (!id) return;
      target.style.transform = "";
      target.style.width = "";
      target.style.height = "";
      updateLayer(id, {
        position: normalizePoint({ x: left, y: top }, { w: canvasWidth, h: canvasHeight }),
        size: normalizeSize({ w: width, h: height }, { w: canvasWidth, h: canvasHeight }),
      });
    },
    [canvasWidth, canvasHeight, updateLayer]
  );

  // Track last known rect per target during drag/resize
  const lastRect = useRef<Map<string, { left: number; top: number; width: number; height: number }>>(new Map());

  const storeRect = (target: HTMLElement | SVGElement, left: number, top: number, width: number, height: number) => {
    const id = target.getAttribute("data-layer-id");
    if (id) lastRect.current.set(id, { left, top, width, height });
  };

  const commitTarget = (target: HTMLElement | SVGElement) => {
    const id = target.getAttribute("data-layer-id");
    const r = id ? lastRect.current.get(id) : null;
    if (r) {
      commit(target as HTMLElement, r.left, r.top, r.width, r.height);
      lastRect.current.delete(id!);
    }
  };

  const commitAll = (targets: Array<HTMLElement | SVGElement>) => targets.forEach(commitTarget);

  return (
    <>
      <Moveable
        ref={moveableRef}
        target={targets}
        container={containerRef.current}
        draggable
        resizable
        snappable
        keepRatio={false}
        throttleDrag={0}
        throttleResize={0}
        verticalGuidelines={[0, canvasWidth / 2, canvasWidth]}
        horizontalGuidelines={[0, canvasHeight / 2, canvasHeight]}
        elementGuidelines={elementGuidelines}
        snapThreshold={8}
        isDisplaySnapDigit
        onDrag={({ target, left, top, width, height, transform }) => {
          target.style.transform = transform;
          storeRect(target, left, top, width, height);
        }}
        onDragEnd={({ target }) => commitTarget(target)}
        onResize={({ target, width, height, transform, drag }) => {
          target.style.width = `${width}px`;
          target.style.height = `${height}px`;
          target.style.transform = transform;
          storeRect(target, drag.left, drag.top, width, height);
        }}
        onResizeEnd={({ target }) => commitTarget(target)}
        onDragGroup={({ events }) => {
          events.forEach(({ target, left, top, width, height, transform }) => {
            target.style.transform = transform;
            storeRect(target, left, top, width, height);
          });
        }}
        onDragGroupEnd={({ targets: ts }) => commitAll(ts)}
        onResizeGroup={({ events }) => {
          events.forEach(({ target, width, height, transform, drag }) => {
            target.style.width = `${width}px`;
            target.style.height = `${height}px`;
            target.style.transform = transform;
            storeRect(target, drag.left, drag.top, width, height);
          });
        }}
        onResizeGroupEnd={({ targets: ts }) => commitAll(ts)}
      />

      <Selecto
        ref={selectoRef}
        dragContainer={containerRef.current}
        selectableTargets={[".creative-layer"]}
        hitRate={0}
        selectByClick
        selectFromInside
        toggleContinueSelect={["shift"]}
        onDragStart={(e) => {
          const input = e.inputEvent.target as HTMLElement;

          // Let Moveable own its handles and control points
          if (moveableRef.current?.isMoveableElement(input)) {
            e.stop();
            return;
          }

          // Use ref to avoid stale closure — let Moveable handle drags on selected layers
          if (targetsRef.current.some((t) => t === input || t.contains(input))) {
            e.stop();
          }
        }}
        onSelectEnd={(e) => {
          const selected = e.selected;
          const isShift = e.inputEvent.shiftKey;

          // When clicking (not drag-selecting) on overlapping layers,
          // only select the topmost one (highest zIndex).
          const isDragSelect = e.rect.width > 2 || e.rect.height > 2;

          if (!isDragSelect && selected.length > 1) {
            const topEl = selected.reduce((a, b) => {
              const zA = parseInt((a as HTMLElement).style.zIndex || "0", 10);
              const zB = parseInt((b as HTMLElement).style.zIndex || "0", 10);
              return zB > zA ? b : a;
            });
            const id = topEl.getAttribute("data-layer-id");
            if (id) setSelectedLayerIds([id], isShift);
            return;
          }

          const ids = selected
            .map((el) => el.getAttribute("data-layer-id"))
            .filter(Boolean) as string[];

          setSelectedLayerIds(ids, isShift);
        }}
      />
    </>
  );
};
