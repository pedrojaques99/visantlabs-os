// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

afterEach(cleanup);

const options = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
];

describe('SegmentedControl', () => {
  it('renders a named radiogroup with the current value checked', () => {
    render(
      h(SegmentedControl, { options, value: 'list', onChange: () => {}, 'aria-label': 'View' })
    );
    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'List' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Grid' }).getAttribute('aria-checked')).toBe('false');
  });

  it('arrow keys move focus (wrapping) and Space selects', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(h(SegmentedControl, { options, value: 'grid', onChange, 'aria-label': 'View' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Grid' }));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'List' }));
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Board' }));
    await user.keyboard('[Space]');
    expect(onChange).toHaveBeenCalledWith('board');
  });

  it('clicking the active segment never deselects', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(h(SegmentedControl, { options, value: 'grid', onChange, 'aria-label': 'View' }));
    await user.click(screen.getByRole('radio', { name: 'Grid' }));
    expect(onChange).not.toHaveBeenCalled();
  });
  it('size xs uses the dense item height', () => {
    render(
      h(SegmentedControl, {
        options,
        value: 'grid',
        onChange: () => {},
        'aria-label': 'View',
        size: 'xs',
      })
    );
    expect(screen.getByRole('radio', { name: 'Grid' }).className).toContain('h-6');
  });

  it('default: segments shrink and labels truncate, with a tooltip only while cut off', () => {
    render(
      h(SegmentedControl, { options, value: 'grid', onChange: () => {}, 'aria-label': 'View' })
    );
    const item = screen.getByRole('radio', { name: 'Board' });
    expect(item.className).toContain('min-w-0');
    const label = item.querySelector('[data-segment-label]') as HTMLElement;
    expect(label.className).toContain('truncate');
    // jsdom has no layout: fake an overflowing label.
    Object.defineProperty(label, 'scrollWidth', { configurable: true, value: 80 });
    Object.defineProperty(label, 'clientWidth', { configurable: true, value: 40 });
    fireEvent.pointerEnter(item);
    expect(item.getAttribute('title')).toBe('Board');
    Object.defineProperty(label, 'scrollWidth', { configurable: true, value: 40 });
    fireEvent.pointerEnter(item);
    expect(item.hasAttribute('title')).toBe(false);
  });

  it('scrollable: hidden scrollbar, segments keep width, active scrolls into view', () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(
        h(SegmentedControl, {
          options,
          value: 'board',
          onChange: () => {},
          'aria-label': 'Tabs',
          scrollable: true,
          size: 'xs',
        })
      );
      const group = screen.getByRole('radiogroup', { name: 'Tabs' });
      expect(group.className).toContain('overflow-x-auto');
      expect(group.className).toContain('scrollbar-none');
      expect(screen.getByRole('radio', { name: 'Grid' }).className).toContain('shrink-0');
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
