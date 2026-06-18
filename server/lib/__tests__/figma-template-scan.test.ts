import { describe, it, expect } from 'vitest';
import { templatesFromDocument } from '../figma-template-scan.js';

const document = {
  children: [
    {
      type: 'CANVAS',
      name: 'Page 1',
      children: [
        {
          type: 'FRAME',
          id: '1:1',
          name: '[Template] Post/Launch',
          absoluteBoundingBox: { width: 1080, height: 1350 },
          children: [
            { type: 'TEXT', id: '1:2', name: '#h1', characters: 'Big news' },
            { type: 'RECTANGLE', id: '1:3', name: '#photo1' },
            { type: 'TEXT', id: '1:4', name: '#h2?', characters: 'sub' },
            { type: 'RECTANGLE', id: '1:5', name: '#logo:dark?' },
            { type: 'TEXT', id: '1:6', name: 'Heading (not a slot)' },
            {
              type: 'FRAME',
              id: '1:7',
              name: 'group',
              children: [{ type: 'TEXT', id: '1:8', name: '#infos[]?', characters: 'a' }],
            },
          ],
        },
        { type: 'FRAME', id: '2:1', name: 'Just a frame', children: [] },
      ],
    },
  ],
};

describe('templatesFromDocument', () => {
  it('finds [Template] frames and derives their slot manifests', () => {
    const t = templatesFromDocument(document);
    expect(t).toHaveLength(1);
    const m = t[0];
    expect(m.name).toBe('Post/Launch');
    expect(m.width).toBe(1080);
    expect(m.aspect).toBe('4:5');

    const byId = Object.fromEntries(m.slots.map((s) => [s.id, s]));
    expect(byId.h1).toMatchObject({ type: 'text', optional: false, sample: 'Big news' });
    expect(byId.photo1).toMatchObject({ type: 'image', optional: false });
    expect(byId.h2).toMatchObject({ type: 'text', optional: true });
    expect(byId.logo).toMatchObject({ type: 'image', optional: true, variant: 'dark' });
    expect(byId.infos).toMatchObject({ type: 'text', list: true }); // nested slot found
    expect(byId.Heading).toBeUndefined(); // non-slot layer ignored
  });

  it('ignores non-template frames and empty documents', () => {
    expect(templatesFromDocument({ children: [] })).toEqual([]);
    expect(templatesFromDocument(null)).toEqual([]);
  });
});
