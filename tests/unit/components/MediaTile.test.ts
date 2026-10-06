// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, type ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaTile } from '@/components/ui/MediaTile';

afterEach(cleanup);

describe('MediaTile', () => {
  it('main action is a stretched button named by the title; actions are siblings, not nested', () => {
    const onClick = vi.fn();
    render(
      h(MediaTile, {
        src: 'https://example.com/a.png',
        alt: 'Cover',
        title: 'Summer poster',
        onClick,
        actions: h('button', { type: 'button', 'aria-label': 'Delete' }, 'x'),
      })
    );
    const main = screen.getByRole('button', { name: 'Summer poster' });
    const del = screen.getByRole('button', { name: 'Delete' });
    expect(main.contains(del)).toBe(false);
    expect(del.parentElement!.closest('button, a')).toBeNull();
    fireEvent.click(main);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('actions are reachable by keyboard focus (Tab order: main, then actions)', async () => {
    const user = userEvent.setup();
    render(
      h(MediaTile, {
        alt: 'Cover',
        title: 'Tile',
        onClick: () => {},
        actions: h('button', { type: 'button', 'aria-label': 'Download' }, 'd'),
      })
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tile' }));
    await user.tab();
    const action = screen.getByRole('button', { name: 'Download' });
    expect(document.activeElement).toBe(action);
    // Reveal is CSS: the wrapper reveals on group-focus-within and on touch (hoverReveal SSoT).
    expect(action.parentElement!.className).toContain('group-focus-within:opacity-100');
    expect(action.parentElement!.className).toContain('[@media(hover:hover)]:opacity-0');
  });

  it('missing src renders the Thumb fallback instead of an empty box', () => {
    render(h(MediaTile, { alt: 'Logo', fallbackLabel: 'unavailable' }));
    expect(screen.getByRole('img', { name: 'unavailable' })).toBeTruthy();
  });

  it('href renders a router link; selected exposes aria-pressed on the button', () => {
    render(
      h(MemoryRouter, null, h(MediaTile, { alt: 'Cover', title: 'Brand', href: '/brands/1' }))
    );
    expect(screen.getByRole('link', { name: 'Brand' }).getAttribute('href')).toBe('/brands/1');
    cleanup();
    render(h(MediaTile, { alt: 'Cover', title: 'Pick', onClick: () => {}, selected: true }));
    expect(screen.getByRole('button', { name: 'Pick' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('overlay layout hides the text block but keeps the accessible name', () => {
    render(
      h(MediaTile, { alt: 'Cover', title: 'Hidden title', layout: 'overlay', onClick: () => {} })
    );
    expect(screen.queryByText('Hidden title')).toBeNull();
    expect(screen.getByRole('button', { name: 'Hidden title' })).toBeTruthy();
  });

  it('no slop classes: no zoom, no gradient, no blur, no transition-all', () => {
    const { container } = render(
      h(MediaTile, { src: 'https://example.com/a.png', alt: 'Cover', title: 'T' })
    );
    const html = container.innerHTML;
    expect(html).not.toMatch(/scale-|bg-gradient|from-black|backdrop-blur|transition-all/);
  });
  describe('DS evolution props', () => {
    it('onClick receives the mouse event (shift-click selection)', () => {
      const onClick = vi.fn();
      render(h(MediaTile, { alt: 'Cover', title: 'Pick', onClick }));
      fireEvent.click(screen.getByRole('button', { name: 'Pick' }), { shiftKey: true });
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick.mock.calls[0][0].shiftKey).toBe(true);
    });

    it('forwards data-*, id and drag handlers to the root', () => {
      const onDragEnd = vi.fn();
      const { container } = render(
        h(MediaTile, {
          alt: 'Logo',
          title: 'Logo',
          onClick: () => {},
          id: 'tile-1',
          'data-vsn-project-id': 'p1',
          draggable: true,
          onDragEnd,
        } as ComponentProps<typeof MediaTile>)
      );
      const root = container.firstElementChild as HTMLElement;
      expect(root.id).toBe('tile-1');
      expect(root.getAttribute('data-vsn-project-id')).toBe('p1');
      expect(root.getAttribute('draggable')).toBe('true');
      fireEvent.dragEnd(root);
      expect(onDragEnd).toHaveBeenCalledTimes(1);
    });

    it('drag started on the stretched button reaches the root handler; img is not the drag source', () => {
      const onDragStart = vi.fn();
      const setDragImage = vi.fn();
      const { container } = render(
        h(MediaTile, {
          src: 'https://example.com/a.png',
          alt: 'Logo',
          title: 'Logo',
          onClick: () => {},
          draggable: true,
          onDragStart,
        })
      );
      const root = container.firstElementChild;
      const btn = screen.getByRole('button', { name: 'Logo' });
      expect(btn.getAttribute('draggable')).toBe('true');
      let currentTarget: EventTarget | null = null;
      onDragStart.mockImplementation((e: { currentTarget: EventTarget }) => {
        currentTarget = e.currentTarget;
      });
      fireEvent.dragStart(btn, { dataTransfer: { setDragImage, setData: vi.fn() } });
      expect(onDragStart).toHaveBeenCalledTimes(1);
      expect(currentTarget).toBe(root);
      // Drag image is the whole tile, not the transparent stretched button.
      expect(setDragImage.mock.calls[0][0]).toBe(root);
      expect(container.querySelector('img')!.getAttribute('draggable')).toBe('false');
    });

    it('not draggable by default: no draggable attribute on root or button', () => {
      const { container } = render(h(MediaTile, { alt: 'C', title: 'T', onClick: () => {} }));
      expect((container.firstElementChild as HTMLElement).hasAttribute('draggable')).toBe(false);
      expect(screen.getByRole('button', { name: 'T' }).hasAttribute('draggable')).toBe(false);
    });

    it('onImageLoad / onImageError reach the img; error still shows the fallback tile', () => {
      const onImageLoad = vi.fn();
      const onImageError = vi.fn();
      const { container } = render(
        h(MediaTile, {
          src: 'https://example.com/dead.png',
          alt: 'Dead',
          fallbackLabel: 'unavailable',
          onImageLoad,
          onImageError,
        })
      );
      const img = container.querySelector('img')!;
      fireEvent.load(img);
      expect(onImageLoad).toHaveBeenCalledTimes(1);
      fireEvent.error(img);
      expect(onImageError).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('img', { name: 'unavailable' })).toBeTruthy();
    });

    it('placeholder paints under the image until it loads', () => {
      const { container } = render(
        h(MediaTile, {
          src: 'https://example.com/a.png',
          alt: 'A',
          placeholder: 'data:image/png;base64,AAAA',
        })
      );
      const img = container.querySelector('img')!;
      expect(img.style.backgroundImage).toContain('data:image/png;base64,AAAA');
      fireEvent.load(img);
      expect(img.style.backgroundImage).toBe('');
    });

    it('fallback node replaces the icon when src is missing', () => {
      render(
        h(MediaTile, {
          alt: 'Acme',
          fallback: h('span', { 'data-testid': 'avatar' }, 'AC'),
        })
      );
      expect(screen.getByTestId('avatar').textContent).toBe('AC');
      expect(screen.getByRole('img', { name: 'Acme' })).toBeTruthy();
    });

    it('leading renders beside the title without nesting a div in a <p>', () => {
      const { container } = render(
        h(MediaTile, {
          alt: 'C',
          title: 'Acme',
          subtitle: 'Brand',
          leading: h('div', { 'data-testid': 'lead' }, 'A'),
        })
      );
      expect(screen.getByTestId('lead')).toBeTruthy();
      expect(container.querySelector('p')).toBeNull();
    });

    it('actionsVisible="always" drops the hover reveal', () => {
      render(
        h(MediaTile, {
          alt: 'C',
          title: 'T',
          actionsVisible: 'always',
          actions: h('button', { type: 'button', 'aria-label': 'Like' }, 'l'),
        })
      );
      const wrap = screen.getByRole('button', { name: 'Like' }).parentElement!;
      expect(wrap.className).not.toContain('[@media(hover:hover)]:opacity-0');
    });

    it('persistentActions stay visible while actions keep the hover reveal', () => {
      render(
        h(MediaTile, {
          alt: 'C',
          title: 'T',
          onClick: () => {},
          actions: h('button', { type: 'button', 'aria-label': 'Delete' }, 'x'),
          persistentActions: h('button', { type: 'button', 'aria-label': 'Like' }, 'l'),
        })
      );
      const like = screen.getByRole('button', { name: 'Like' });
      const del = screen.getByRole('button', { name: 'Delete' });
      expect(like.parentElement!.className).not.toContain('opacity-0');
      expect(del.parentElement!.className).toContain('[@media(hover:hover)]:opacity-0');
      // Same cluster, never nested in the stretched main action.
      expect(like.parentElement!.parentElement).toBe(del.parentElement!.parentElement);
      expect(like.closest('button')).toBe(like);
      expect(screen.getByRole('button', { name: 'T' }).contains(like)).toBe(false);
    });

    it('persistentActions render alone without an actions prop', () => {
      render(
        h(MediaTile, {
          alt: 'C',
          title: 'T',
          persistentActions: h('button', { type: 'button', 'aria-label': 'Like' }, 'l'),
        })
      );
      const like = screen.getByRole('button', { name: 'Like' });
      expect(like.parentElement!.className).not.toContain('opacity-0');
    });

    it('density defaults to the roomy text block (p-3, text-sm title)', () => {
      render(h(MediaTile, { alt: 'C', title: 'Primary' }));
      const title = screen.getByText('Primary');
      const block = title.closest('[data-density]') as HTMLElement;
      expect(block.getAttribute('data-density')).toBe('default');
      expect(block.className).toContain('p-3');
      expect(title.className).toContain('text-sm');
    });

    it('density="compact" tightens padding and drops the title to text-xs', () => {
      render(h(MediaTile, { alt: 'C', title: 'Primary', subtitle: 'svg', density: 'compact' }));
      const title = screen.getByText('Primary');
      const block = title.closest('[data-density]') as HTMLElement;
      expect(block.getAttribute('data-density')).toBe('compact');
      expect(block.className).toContain('px-2');
      expect(block.className).toContain('py-1.5');
      expect(block.className).not.toContain('p-3');
      expect(title.className).toContain('text-xs');
      expect(title.className).not.toContain('text-sm');
    });

    it('subtitleLines=2 clamps instead of truncating', () => {
      render(
        h(MediaTile, { alt: 'C', title: 'T', subtitle: 'Long description', subtitleLines: 2 })
      );
      const sub = screen.getByText('Long description');
      expect(sub.className).toContain('line-clamp-2');
      expect(sub.className).not.toContain('truncate');
    });

    it('editableTitle sits above the stretched action and never fires onClick', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        h(MediaTile, {
          alt: 'C',
          title: 'Project',
          onClick,
          editableTitle: h('input', { 'aria-label': 'Rename', defaultValue: 'Project' }),
        })
      );
      const input = screen.getByRole('textbox', { name: 'Rename' });
      expect(input.parentElement!.className).toContain('z-20');
      await user.click(input);
      await user.type(input, 'x{Enter}');
      expect(onClick).not.toHaveBeenCalled();
      // Accessible name still comes from title.
      expect(screen.getByRole('button', { name: 'Project' })).toBeTruthy();
    });

    it('footer is clickable and does not trigger the main action', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onTool = vi.fn();
      render(
        h(MediaTile, {
          alt: 'C',
          title: 'Mockup',
          onClick,
          footer: h('button', { type: 'button', onClick: onTool }, 'Upscale'),
        })
      );
      const tool = screen.getByRole('button', { name: 'Upscale' });
      expect(tool.parentElement!.className).toContain('z-20');
      await user.click(tool);
      expect(onTool).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('busy overlays the cover and sets aria-busy; a node renders as-is', () => {
      const { container, rerender } = render(h(MediaTile, { alt: 'C', title: 'T', busy: true }));
      const root = () => container.firstElementChild as HTMLElement;
      expect(root().getAttribute('aria-busy')).toBe('true');
      rerender(h(MediaTile, { alt: 'C', title: 'T', busy: h('span', null, 'Generating') }));
      expect(screen.getByText('Generating')).toBeTruthy();
      rerender(h(MediaTile, { alt: 'C', title: 'T', busy: false }));
      expect(root().hasAttribute('aria-busy')).toBe(false);
    });
  });
});
