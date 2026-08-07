/**
 * SSoT for revealing a FUNCTIONAL control (delete, download, pin, edit…) that
 * should surface on hover — the spine-7 fix for the pervasive
 * `opacity-0 group-hover:opacity-100`, which is dead on touch (no hover event →
 * control never appears **and** is unreachable) and invisible on keyboard focus.
 *
 * This keeps the control visible where there's no hover (coarse pointers), hides
 * it only on hover-capable pointers until hover, and always reveals it on
 * keyboard focus of a child. Compose with `cn()`; the PARENT must carry `group`.
 *
 *   <div className="group …">
 *     <button className={cn(hoverReveal, '…')}>…</button>
 *   </div>
 *
 * NOTE: only works for the bare `group`. Named groups (`group/thumb`) need the
 * literal written inline — a template-built class name is purged by Tailwind's
 * scanner, so this is intentionally a static string, not a builder.
 */
export const hoverReveal =
  'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity';
