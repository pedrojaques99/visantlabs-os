import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { TermsOfServicePage } from '@/pages/TermsOfServicePage';
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage';

/**
 * SSR entry for prerendering the legal pages to static HTML.
 *
 * Reuses the real React page components (single source of truth for the legal
 * copy, which itself lives in the i18n JSON) so the static fallback can never
 * drift from what the SPA renders. Consumed by scripts/prerender-legal.mjs.
 */
export interface LegalRoute {
  route: string;
  title: string;
  Component: React.ComponentType;
}

export const ROUTES: LegalRoute[] = [
  { route: '/terms', title: 'Terms of Service — Visant Labs®', Component: TermsOfServicePage },
  { route: '/privacy', title: 'Privacy Policy — Visant Labs®', Component: PrivacyPolicyPage },
];

export function render(route: string): string {
  const match = ROUTES.find((r) => r.route === route);
  if (!match) throw new Error(`No legal route registered for "${route}"`);
  const Component = match.Component;
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[route]}>
      <Component />
    </MemoryRouter>
  );
}
