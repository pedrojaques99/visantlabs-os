import React, { useEffect, useRef, useState, useCallback } from "react";
import Moveable from "react-moveable";
import Selecto from "react-selecto";
import { useCreativeStore } from "./store/creativeStore";
import { normalizePoint, normalizeSize } from "@/lib/pixel";

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const CreativeMoveable: React.FC<Props> = ({ canvasWidth, canvasHeight, containerRef }) => {
  const { layers, selectedLayerIds, setSelectedLayerIds, updateLayer } = useCreativeStore();

  const moveableRef = useRef<Moveable>(null);
  const [targets, setTargets] = useState<Array<HTMLElement | SVGElement>>([]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  // Sync selected layer DOM elements → Moveable targets
  useEffect(() => {
    if (!containerRef.current) return;
    const next = selectedLayerIds
      .map((id) => containerRef.current!.querySelector<HTMLElement>(`[data-layer-id="${id}"]`))
      .filter(Boolean) as HTMLElement[];
    setTargets(next);
  }, [selectedLayerIds, layers, containerRef]);

  // Refresh handles on canvas resize
  useEffect(() => {
    moveableRef.current?.updateRect();
  }, [canvasWidth, canvasHeight]);

  // Unselected layers act as snap guides
  const elementGuidelines = (() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(".creative-layer"))
      .filter((el) => !selectedLayerIds.includes(el.getAttribute("data-layer-id") ?? ""));
  })();

  // Persist position+size to store and sync Moveable after React re-renders
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
      requestAnimationFrame(() => moveableRef.current?.updateRect());
    },
    [canvasWidth, canvasHeight, updateLayer]
  );

  // Per-target rect cache so onEnd doesn't need to re-read the DOM
  const lastRect = useRef(new Map<string, { left: number; top: number; width: number; height: number }>());

  const saveRect = (target: HTMLElement | SVGElement, left: number, top: number, width: number, height: number) => {
    const id = target.getAttribute("data-layer-id");
    if (id) lastRect.current.set(id, { left, top, width, height });
  };

  const flush = (target: HTMLElement | SVGElement) => {
    const id = target.getAttribute("data-layer-id");
    if (!id) return;
    const r = lastRect.current.get(id);
    if (!r) return;
    lastRect.current.delete(id);
    commit(target as HTMLElement, r.left, r.top, r.width, r.height);
  };

  return (
    <>
      <Moveable
        ref={moveableRef}
        target={targets}
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
          saveRect(target, left, top, width, height);
        }}
        onDragEnd={({ target }) => flush(target)}
        onResize={({ target, width, height, transform, drag }) => {
          target.style.width = `${width}px`;
          target.style.height = `${height}px`;
          target.style.transform = transform;
          saveRect(target, drag.left, drag.top, width, height);
        }}
        onResizeEnd={({ target }) => flush(target)}
        onDragGroup={({ events }) => events.forEach(({ target, left, top, width, height, transform }) => {
          target.style.transform = transform;
          saveRect(target, left, top, width, height);
        })}
        onDragGroupEnd={({ targets: ts }) => ts.forEach(flush)}
        onResizeGroup={({ events }) => events.forEach(({ target, width, height, transform, drag }) => {
          target.style.width = `${width}px`;
          target.style.height = `${height}px`;
          target.style.transform = transform;
          saveRect(target, drag.left, drag.top, width, height);
        })}
        onResizeGroupEnd={({ targets: ts }) => ts.forEach(flush)}
      />

      <Selecto
        dragContainer={containerRef.current}
        selectableTargets={[".creative-layer"]}
        hitRate={0}
        selectByClick
        selectFromInside
        toggleContinueSelect={["shift"]}
        onDragStart={(e) => {
          const input = e.inputEvent.target as HTMLElement;
          // Yield to Moveable for its own handles or already-selected layers
          if (
            moveableRef.current?.isMoveableElement(input) ||
            targetsRef.current.some((t) => t === input || t.contains(input))
          ) {
            e.stop();
          }
        }}
        onSelectEnd={(e) => {
          const isShift = e.inputEvent.shiftKey;
          const isDrag = e.rect.width > 2 || e.rect.height > 2;

          // Click on overlapping layers → pick topmost by zIndex
          if (!isDrag && e.selected.length > 1) {
            const top = e.selected.reduce((a, b) =>
              parseInt((b as HTMLElement).style.zIndex || "0", 10) >
              parseInt((a as HTMLElement).style.zIndex || "0", 10) ? b : a
            );
            const id = top.getAttribute("data-layer-id");
            if (id) setSelectedLayerIds([id], isShift);
            return;
          }

          const ids = e.selected
            .map((el) => el.getAttribute("data-layer-id"))
            .filter(Boolean) as string[];
          setSelectedLayerIds(ids, isShift);
        }}
      />
    </>
  );
};
