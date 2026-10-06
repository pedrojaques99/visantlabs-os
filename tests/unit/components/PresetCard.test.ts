// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { PresetCard } from '@/components/PresetCard';
import type { CommunityPrompt } from '@/types/communityPrompts';

afterEach(cleanup);

const preset = {
  id: 'p1',
  userId: 'u1',
  name: 'Poster',
  description: 'desc',
  prompt: 'prompt',
  category: 'mockup',
  presetType: 'mockup',
  likesCount: 7,
  isLikedByUser: false,
  isApproved: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} as unknown as CommunityPrompt;

const t = (k: string) => k;

describe('PresetCard actions', () => {
  it('only the like toggle stays visible; owner/admin actions keep the hover reveal', () => {
    render(
      h(PresetCard, {
        preset,
        currentUserId: 'u1',
        isAuthenticated: true,
        canEdit: true,
        t,
        onClick: () => {},
        onEdit: () => {},
        onDelete: () => {},
        onToggleLike: () => {},
      })
    );
    const like = screen.getByRole('button', { name: 'communityPresets.actions.like' });
    expect(like.closest('[data-persistent-actions]')).not.toBeNull();
    expect(like.parentElement!.className).not.toContain('opacity-0');
    const edit = screen.getByRole('button', { name: 'common.edit' });
    expect(edit.closest('[data-persistent-actions]')).toBeNull();
    expect(edit.parentElement!.className).toContain('[@media(hover:hover)]:opacity-0');
    // Count shows once (on the toggle), never repeated in meta.
    expect(screen.getAllByText('7')).toHaveLength(1);
  });

  it('without a like toggle the count falls back to meta', () => {
    render(h(PresetCard, { preset, isAuthenticated: false, canEdit: false, t }));
    expect(screen.queryByRole('button', { name: 'communityPresets.actions.like' })).toBeNull();
    expect(screen.getAllByText('7')).toHaveLength(1);
  });
});
