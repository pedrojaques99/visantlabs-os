# Brand Guidelines — Architecture

## Data flow

```
User edits section
  → local useState (immediate feedback)
  → useDebounceAndPersist (800ms debounce)
  → onUpdate(patch: Partial<BrandGuideline>)
  → useUpdateGuideline mutation (react-query)
  → brandGuidelineApi.update(id, patch)
  → PUT /brand-guidelines/:id
```

## File map

| Purpose | File |
|---------|------|
| Section metadata registry | `sections-manifest.ts` |
| Section barrel export | `sections/index.ts` |
| Shared debounce hook | `src/hooks/useDebounceAndPersist.ts` |
| CSS string builders | `src/utils/brand-css.ts` |
| Random ID generator | `src/utils/id.ts` |
| All brand types | `src/lib/figma-types.ts` (line ~673) |
| React-Query mutations | `src/hooks/queries/useBrandGuidelines.ts` |
| API client | `src/services/brandGuidelineApi.ts` |

## Adding a new section

1. Create `sections/MySection.tsx` — use `useDebounceAndPersist` hook, follow ColorsSection as template
2. Export from `sections/index.ts`
3. Add metadata to `sections-manifest.ts` (id, label, icon, defaultSpan)
4. Add a `case 'mySection'` to `GuidelineDetail.tsx` renderSection()
5. Add field to `BrandGuideline` in `figma-types.ts`

That's it. Sidebar toggle, DEFAULT_BLOCKS, and barrel export are all derived automatically.

## Section template

```tsx
import { useDebounceAndPersist } from '@/hooks/useDebounceAndPersist';

export const MySection = ({ guideline, onUpdate, span }) => {
  const [local, setLocal] = useState(guideline.myField || defaultValue);
  const { isSaving, persist } = useDebounceAndPersist(
    (value) => onUpdate({ myField: value })
  );

  useEffect(() => { setLocal(guideline.myField || defaultValue); }, [guideline.id]);

  const update = (patch) => {
    const next = { ...local, ...patch };
    setLocal(next);
    persist(next);
  };

  return (
    <SectionBlock id="mySection" title="My Section" isSaving={isSaving} span={span}>
      {/* always-visible inline fields — no edit/view toggle */}
    </SectionBlock>
  );
};
```

## Design rules for sections

- No `isEditing` toggle — fields are always visible and editable
- No `expandedContent` modal — content lives directly in the block
- Auto-save via debounce — no Save/Cancel buttons
- Hover-reveal for secondary controls (use `group/item` + `max-h-0 group-hover:max-h-[N]`)
- No `brand-cyan` except SectionBlock's save icon (handled internally)
- Empty state: `<p className="text-[11px] text-neutral-700">No X yet.</p>`
