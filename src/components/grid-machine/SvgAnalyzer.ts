export interface Point {
  x: number;
  y: number;
  type: 'anchor' | 'handle';
}

export interface Segment {
  from: Point;
  to: Point;
  type: 'line' | 'curve';
  handles?: Point[];
}

export interface GridLine {
  type: 'horizontal' | 'vertical' | 'diagonal';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SvgAnalysis {
  viewBox: { x: number; y: number; width: number; height: number };
  points: Point[];
  segments: Segment[];
  svgElement: SVGSVGElement | null;
}

function parsePathData(d: string): { anchors: Point[]; handles: Point[]; segments: Segment[] } {
  const anchors: Point[] = [];
  const handles: Point[] = [];
  const segments: Segment[] = [];

  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  if (!commands) return { anchors, handles, segments };

  let cx = 0,
    cy = 0;
  let startX = 0,
    startY = 0;

  for (const cmd of commands) {
    const type = cmd[0];
    const nums =
      cmd
        .slice(1)
        .trim()
        .match(/-?\d+\.?\d*(?:e[+-]?\d+)?/gi)
        ?.map(Number) || [];
    const isRel = type === type.toLowerCase();

    switch (type.toUpperCase()) {
      case 'M': {
        for (let i = 0; i < nums.length; i += 2) {
          cx = isRel ? cx + nums[i] : nums[i];
          cy = isRel ? cy + nums[i + 1] : nums[i + 1];
          if (i === 0) {
            startX = cx;
            startY = cy;
          }
          anchors.push({ x: cx, y: cy, type: 'anchor' });
        }
        break;
      }
      case 'L': {
        for (let i = 0; i < nums.length; i += 2) {
          const prev: Point = { x: cx, y: cy, type: 'anchor' };
          cx = isRel ? cx + nums[i] : nums[i];
          cy = isRel ? cy + nums[i + 1] : nums[i + 1];
          const pt: Point = { x: cx, y: cy, type: 'anchor' };
          anchors.push(pt);
          segments.push({ from: prev, to: pt, type: 'line' });
        }
        break;
      }
      case 'H': {
        for (const n of nums) {
          const prev: Point = { x: cx, y: cy, type: 'anchor' };
          cx = isRel ? cx + n : n;
          const pt: Point = { x: cx, y: cy, type: 'anchor' };
          anchors.push(pt);
          segments.push({ from: prev, to: pt, type: 'line' });
        }
        break;
      }
      case 'V': {
        for (const n of nums) {
          const prev: Point = { x: cx, y: cy, type: 'anchor' };
          cy = isRel ? cy + n : n;
          const pt: Point = { x: cx, y: cy, type: 'anchor' };
          anchors.push(pt);
          segments.push({ from: prev, to: pt, type: 'line' });
        }
        break;
      }
      case 'C': {
        for (let i = 0; i < nums.length; i += 6) {
          const prev: Point = { x: cx, y: cy, type: 'anchor' };
          const h1x = isRel ? cx + nums[i] : nums[i];
          const h1y = isRel ? cy + nums[i + 1] : nums[i + 1];
          const h2x = isRel ? cx + nums[i + 2] : nums[i + 2];
          const h2y = isRel ? cy + nums[i + 3] : nums[i + 3];
          cx = isRel ? cx + nums[i + 4] : nums[i + 4];
          cy = isRel ? cy + nums[i + 5] : nums[i + 5];
          const h1: Point = { x: h1x, y: h1y, type: 'handle' };
          const h2: Point = { x: h2x, y: h2y, type: 'handle' };
          const pt: Point = { x: cx, y: cy, type: 'anchor' };
          handles.push(h1, h2);
          anchors.push(pt);
          segments.push({ from: prev, to: pt, type: 'curve', handles: [h1, h2] });
        }
        break;
      }
      case 'S': {
        for (let i = 0; i < nums.length; i += 4) {
          const prev: Point = { x: cx, y: cy, type: 'anchor' };
          const h2x = isRel ? cx + nums[i] : nums[i];
          const h2y = isRel ? cy + nums[i + 1] : nums[i + 1];
          cx = isRel ? cx + nums[i + 2] : nums[i + 2];
          cy = isRel ? cy + nums[i + 3] : nums[i + 3];
          const h2: Point = { x: h2x, y: h2y, type: 'handle' };
          const pt: Point = { x: cx, y: cy, type: 'anchor' };
          handles.push(h2);
          anchors.push(pt);
          segments.push({ from: prev, to: pt, type: 'curve', handles: [h2] });
        }
        break;
      }
      case 'Q': {
        for (let i = 0; i < nums.length; i += 4) {
          const prev: Point = { x: cx, y: cy, type: 'anchor' };
          const hx = isRel ? cx + nums[i] : nums[i];
          const hy = isRel ? cy + nums[i + 1] : nums[i + 1];
          cx = isRel ? cx + nums[i + 2] : nums[i + 2];
          cy = isRel ? cy + nums[i + 3] : nums[i + 3];
          const h: Point = { x: hx, y: hy, type: 'handle' };
          const pt: Point = { x: cx, y: cy, type: 'anchor' };
          handles.push(h);
          anchors.push(pt);
          segments.push({ from: prev, to: pt, type: 'curve', handles: [h] });
        }
        break;
      }
      case 'T': {
        for (let i = 0; i < nums.length; i += 2) {
          const prev: Point = { x: cx, y: cy, type: 'anchor' };
          cx = isRel ? cx + nums[i] : nums[i];
          cy = isRel ? cy + nums[i + 1] : nums[i + 1];
          const pt: Point = { x: cx, y: cy, type: 'anchor' };
          anchors.push(pt);
          segments.push({ from: prev, to: pt, type: 'curve' });
        }
        break;
      }
      case 'A': {
        for (let i = 0; i < nums.length; i += 7) {
          const prev: Point = { x: cx, y: cy, type: 'anchor' };
          cx = isRel ? cx + nums[i + 5] : nums[i + 5];
          cy = isRel ? cy + nums[i + 6] : nums[i + 6];
          const pt: Point = { x: cx, y: cy, type: 'anchor' };
          anchors.push(pt);
          segments.push({ from: prev, to: pt, type: 'curve' });
        }
        break;
      }
      case 'Z': {
        if (cx !== startX || cy !== startY) {
          const prev: Point = { x: cx, y: cy, type: 'anchor' };
          const pt: Point = { x: startX, y: startY, type: 'anchor' };
          segments.push({ from: prev, to: pt, type: 'line' });
        }
        cx = startX;
        cy = startY;
        break;
      }
    }
  }

  return { anchors, handles, segments };
}

function extractFromElement(el: SVGElement): {
  anchors: Point[];
  handles: Point[];
  segments: Segment[];
} {
  const anchors: Point[] = [];
  const handles: Point[] = [];
  const segments: Segment[] = [];

  if (el instanceof SVGPathElement) {
    const d = el.getAttribute('d');
    if (d) return parsePathData(d);
  }

  if (el instanceof SVGRectElement) {
    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    const w = parseFloat(el.getAttribute('width') || '0');
    const h = parseFloat(el.getAttribute('height') || '0');
    const corners: Point[] = [
      { x, y, type: 'anchor' },
      { x: x + w, y, type: 'anchor' },
      { x: x + w, y: y + h, type: 'anchor' },
      { x, y: y + h, type: 'anchor' },
    ];
    anchors.push(...corners);
    for (let i = 0; i < 4; i++) {
      segments.push({ from: corners[i], to: corners[(i + 1) % 4], type: 'line' });
    }
  }

  if (el instanceof SVGCircleElement) {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const r = parseFloat(el.getAttribute('r') || '0');
    anchors.push(
      { x: cx, y: cy - r, type: 'anchor' },
      { x: cx + r, y: cy, type: 'anchor' },
      { x: cx, y: cy + r, type: 'anchor' },
      { x: cx - r, y: cy, type: 'anchor' }
    );
    anchors.push({ x: cx, y: cy, type: 'anchor' });
  }

  if (el instanceof SVGEllipseElement) {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const rx = parseFloat(el.getAttribute('rx') || '0');
    const ry = parseFloat(el.getAttribute('ry') || '0');
    anchors.push(
      { x: cx, y: cy - ry, type: 'anchor' },
      { x: cx + rx, y: cy, type: 'anchor' },
      { x: cx, y: cy + ry, type: 'anchor' },
      { x: cx - rx, y: cy, type: 'anchor' }
    );
    anchors.push({ x: cx, y: cy, type: 'anchor' });
  }

  if (el instanceof SVGLineElement) {
    const x1 = parseFloat(el.getAttribute('x1') || '0');
    const y1 = parseFloat(el.getAttribute('y1') || '0');
    const x2 = parseFloat(el.getAttribute('x2') || '0');
    const y2 = parseFloat(el.getAttribute('y2') || '0');
    const p1: Point = { x: x1, y: y1, type: 'anchor' };
    const p2: Point = { x: x2, y: y2, type: 'anchor' };
    anchors.push(p1, p2);
    segments.push({ from: p1, to: p2, type: 'line' });
  }

  if (el instanceof SVGPolygonElement || el instanceof SVGPolylineElement) {
    const pts = el.getAttribute('points');
    if (pts) {
      const coords = pts
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const polyPoints: Point[] = [];
      for (let i = 0; i < coords.length; i += 2) {
        polyPoints.push({ x: coords[i], y: coords[i + 1], type: 'anchor' });
      }
      anchors.push(...polyPoints);
      for (let i = 0; i < polyPoints.length - 1; i++) {
        segments.push({ from: polyPoints[i], to: polyPoints[i + 1], type: 'line' });
      }
      if (el instanceof SVGPolygonElement && polyPoints.length > 2) {
        segments.push({ from: polyPoints[polyPoints.length - 1], to: polyPoints[0], type: 'line' });
      }
    }
  }

  return { anchors, handles, segments };
}

function applyTransform(points: Point[], el: SVGElement): Point[] {
  const transform = el.getAttribute('transform');
  if (!transform) return points;

  const translateMatch = transform.match(/translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/);
  const scaleMatch = transform.match(/scale\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)/);

  let tx = 0,
    ty = 0,
    sx = 1,
    sy = 1;
  if (translateMatch) {
    tx = parseFloat(translateMatch[1]);
    ty = parseFloat(translateMatch[2]);
  }
  if (scaleMatch) {
    sx = parseFloat(scaleMatch[1]);
    sy = parseFloat(scaleMatch[2] || scaleMatch[1]);
  }

  return points.map((p) => ({ ...p, x: p.x * sx + tx, y: p.y * sy + ty }));
}

export function analyzeSvg(svgString: string): SvgAnalysis {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');

  if (!svgEl) {
    return {
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      points: [],
      segments: [],
      svgElement: null,
    };
  }

  const vbAttr = svgEl.getAttribute('viewBox');
  let viewBox = { x: 0, y: 0, width: 100, height: 100 };
  if (vbAttr) {
    const parts = vbAttr.split(/[\s,]+/).map(Number);
    viewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  } else {
    const w = parseFloat(svgEl.getAttribute('width') || '100');
    const h = parseFloat(svgEl.getAttribute('height') || '100');
    viewBox = { x: 0, y: 0, width: w, height: h };
  }

  const allPoints: Point[] = [];
  const allSegments: Segment[] = [];

  const elements = svgEl.querySelectorAll('path, rect, circle, ellipse, line, polygon, polyline');
  elements.forEach((el) => {
    const { anchors, handles, segments } = extractFromElement(el as SVGElement);
    const transformedAnchors = applyTransform(anchors, el as SVGElement);
    const transformedHandles = applyTransform(handles, el as SVGElement);
    allPoints.push(...transformedAnchors, ...transformedHandles);

    segments.forEach((seg) => {
      const [tFrom] = applyTransform([seg.from], el as SVGElement);
      const [tTo] = applyTransform([seg.to], el as SVGElement);
      const tHandles = seg.handles ? applyTransform(seg.handles, el as SVGElement) : undefined;
      allSegments.push({ from: tFrom, to: tTo, type: seg.type, handles: tHandles });
    });
  });

  return { viewBox, points: allPoints, segments: allSegments, svgElement: svgEl };
}

function filterBySpacing(values: number[], minSpacing: number): number[] {
  if (minSpacing <= 0) return values;
  const result: number[] = [];
  for (const v of values) {
    if (result.length === 0 || Math.abs(v - result[result.length - 1]) >= minSpacing) {
      result.push(v);
    }
  }
  return result;
}

export function generateGridLines(
  points: Point[],
  viewBox: { x: number; y: number; width: number; height: number },
  options: {
    horizontal: boolean;
    vertical: boolean;
    diagonal: boolean;
    hLineSpacing?: number;
    vLineSpacing?: number;
    diagonalSpacing?: number;
  }
): GridLine[] {
  const lines: GridLine[] = [];
  const anchors = points.filter((p) => p.type === 'anchor');

  const uniqueX = [...new Set(anchors.map((p) => Math.round(p.x * 100) / 100))].sort(
    (a, b) => a - b
  );
  const uniqueY = [...new Set(anchors.map((p) => Math.round(p.y * 100) / 100))].sort(
    (a, b) => a - b
  );

  const extent = Math.max(viewBox.width, viewBox.height) * 2;
  const minX = viewBox.x - extent;
  const maxX = viewBox.x + viewBox.width + extent;
  const minY = viewBox.y - extent;
  const maxY = viewBox.y + viewBox.height + extent;

  if (options.vertical) {
    for (const x of filterBySpacing(uniqueX, options.vLineSpacing ?? 0)) {
      lines.push({ type: 'vertical', x1: x, y1: minY, x2: x, y2: maxY });
    }
  }

  if (options.horizontal) {
    for (const y of filterBySpacing(uniqueY, options.hLineSpacing ?? 0)) {
      lines.push({ type: 'horizontal', x1: minX, y1: y, x2: maxX, y2: y });
    }
  }

  if (options.diagonal) {
    const ANGLE_THRESHOLD = 2;
    const targetAngles = [45, -45, 30, -30, 60, -60];
    const seen = new Set<string>();
    const diagOrigins: { x: number; y: number }[] = [];
    const diagSpacing = options.diagonalSpacing ?? 0;

    for (let i = 0; i < anchors.length; i++) {
      for (let j = i + 1; j < anchors.length; j++) {
        const dx = anchors[j].x - anchors[i].x;
        const dy = anchors[j].y - anchors[i].y;
        if (Math.abs(dx) < 0.01 || Math.abs(dy) < 0.01) continue;

        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        for (const target of targetAngles) {
          if (
            Math.abs(angle - target) < ANGLE_THRESHOLD ||
            Math.abs(angle - target + 180) < ANGLE_THRESHOLD ||
            Math.abs(angle - target - 180) < ANGLE_THRESHOLD
          ) {
            const key = `${Math.round(anchors[i].x)},${Math.round(anchors[i].y)},${Math.round(
              target
            )}`;
            if (seen.has(key)) break;
            seen.add(key);

            if (diagSpacing > 0) {
              const tooClose = diagOrigins.some(
                (o) => Math.hypot(o.x - anchors[i].x, o.y - anchors[i].y) < diagSpacing
              );
              if (tooClose) break;
            }
            diagOrigins.push({ x: anchors[i].x, y: anchors[i].y });

            const rad = target * (Math.PI / 180);
            const extend = Math.max(viewBox.width, viewBox.height) * 1.5;
            lines.push({
              type: 'diagonal',
              x1: anchors[i].x - Math.cos(rad) * extend,
              y1: anchors[i].y - Math.sin(rad) * extend,
              x2: anchors[i].x + Math.cos(rad) * extend,
              y2: anchors[i].y + Math.sin(rad) * extend,
            });
            break;
          }
        }
      }
    }
  }

  return lines;
}
