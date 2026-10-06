// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, type ComponentProps } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { Modal } from '@/components/ui/Modal';

afterEach(cleanup);

/** The scrolling body is the element that wraps `children`. */
const bodyOf = (testId: string) => screen.getByTestId(testId).parentElement!;

const renderModal = (props: Partial<ComponentProps<typeof Modal>> = {}) =>
  render(
    h(Modal, {
      isOpen: true,
      onClose: () => {},
      title: 'T',
      ...props,
      children: h('div', { 'data-testid': 'child' }),
    })
  );

describe('Modal bodyClassName', () => {
  it('default body keeps p-6 sm:p-10 md:p-12 and the scroll container', () => {
    renderModal();
    const cls = bodyOf('child').className;
    expect(cls).toContain('overflow-y-auto');
    expect(cls).toContain('p-6');
    expect(cls).toContain('sm:p-10');
    expect(cls).toContain('md:p-12');
  });

  it('bodyClassName overrides every breakpoint padding and keeps the scroll', () => {
    renderModal({ bodyClassName: 'p-0 sm:p-0 md:p-0' });
    const cls = bodyOf('child').className.split(/\s+/);
    expect(cls).toEqual(expect.arrayContaining(['p-0', 'sm:p-0', 'md:p-0', 'overflow-y-auto']));
    expect(cls).not.toContain('p-6');
    expect(cls).not.toContain('sm:p-10');
    expect(cls).not.toContain('md:p-12');
  });

  it('bodyClassName lands on the body only, not on the panel', () => {
    renderModal({ bodyClassName: 'ds-body-marker' });
    const body = bodyOf('child');
    expect(body.className).toContain('ds-body-marker');
    expect(body.parentElement!.className).not.toContain('ds-body-marker');
  });
});
