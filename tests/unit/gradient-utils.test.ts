import { describe, it, expect } from 'vitest';
import {
  getGradientCss,
  sortStops,
  addStop,
  removeStop,
  updateStop,
  reverseStops,
  MIN_GRADIENT_STOPS,
  type GradientStop,
} from '@/components/controls/gradient-utils';

const BASE: GradientStop[] = [
  { color: '#000000', position: 0, opacity: 1 },
  { color: '#FFFFFF', position: 1, opacity: 1 },
];

describe('gradient-utils', () => {
  describe('getGradientCss', () => {
    it('builds a linear gradient with angle + stops', () => {
      const css = getGradientCss('linear', BASE, 45);
      expect(css).toContain('linear-gradient(45deg');
      expect(css).toContain('#000000 0%');
      expect(css).toContain('#FFFFFF 100%');
    });

    it('maps each gradient type to the right CSS function', () => {
      expect(getGradientCss('radial', BASE)).toContain('radial-gradient(circle');
      expect(getGradientCss('angular', BASE)).toContain('conic-gradient');
      expect(getGradientCss('diamond', BASE)).toContain('closest-corner');
    });

    it('emits color-mix for partial opacity', () => {
      const css = getGradientCss('linear', [
        { color: '#FF0000', position: 0, opacity: 0.5 },
        { color: '#00FF00', position: 1 },
      ]);
      expect(css).toContain('color-mix(in oklab, #FF0000 50%, transparent)');
      expect(css).toContain('#00FF00 100%');
    });
  });

  describe('sortStops', () => {
    it('orders by position ascending', () => {
      const sorted = sortStops([
        { color: '#111', position: 0.8 },
        { color: '#222', position: 0.1 },
      ]);
      expect(sorted.map((s) => s.position)).toEqual([0.1, 0.8]);
    });
  });

  describe('addStop', () => {
    it('adds a stop, keeps it sorted, and returns its index', () => {
      const { stops, index } = addStop(BASE, 0.5, BASE[0]);
      expect(stops).toHaveLength(3);
      expect(stops[index].position).toBe(0.5);
      expect(stops.map((s) => s.position)).toEqual([0, 0.5, 1]);
    });
  });

  describe('removeStop', () => {
    it('removes a stop', () => {
      expect(removeStop([...BASE, { color: '#888', position: 0.5 }], 1)).toHaveLength(2);
    });
    it('never drops below the minimum stop count', () => {
      expect(removeStop(BASE, 0)).toHaveLength(MIN_GRADIENT_STOPS);
    });
  });

  describe('updateStop', () => {
    it('patches only the targeted stop', () => {
      const out = updateStop(BASE, 1, { color: '#ABCDEF' });
      expect(out[1].color).toBe('#ABCDEF');
      expect(out[0].color).toBe('#000000');
    });
  });

  describe('reverseStops', () => {
    it('mirrors stop positions', () => {
      const out = reverseStops([
        { color: '#a', position: 0 },
        { color: '#b', position: 0.25 },
        { color: '#c', position: 1 },
      ]);
      expect(out.map((s) => s.position)).toEqual([0, 0.75, 1]);
    });
  });
});
