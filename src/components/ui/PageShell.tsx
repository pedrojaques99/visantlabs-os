import React from 'react';
import { Link } from 'react-router-dom';
import { SEO } from '../SEO';
import {
  BreadcrumbWithBack,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './BreadcrumbWithBack';
import { MicroTitle } from './MicroTitle';
import { cn } from '@/lib/utils';

export interface BreadcrumbSegment {
  label: string;
  to?: string;
}

export interface PageShellProps {
  /** Stable id for data-vsn-page / telemetry */
  pageId: string;
  /** Component name for data-vsn-component (defaults to PascalCase of pageId) */
  componentName?: string;

  /** SEO */
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;

  /** Header */
  title: React.ReactNode;
  /** Uppercase mono micro-title above the main title (ex: "Module // Assets") */
  microTitle?: React.ReactNode;
  /** Secondary copy under the title */
  description?: React.ReactNode;
  /** Breadcrumb segments; last one renders as BreadcrumbPage */
  breadcrumb?: BreadcrumbSegment[];
  /** Fallback route for BackButton when breadcrumb is empty */
  backTo?: string;
  /** Right side of the title row (buttons, etc) */
  actions?: React.ReactNode;

  /** Layout width — 5xl when page has a sidebar, 7xl fullscreen. Default: 7xl */
  width?: '5xl' | '7xl' | 'full';
  /** Hide the default title block (if the page renders its own header) */
  hideHeader?: boolean;
  /** Hide the default background glow/gradient */
  noBackground?: boolean;
  /** Extra className for the inner content container */
  contentClassName?: string;

  children: React.ReactNode;
}

const WIDTH_MAP: Record<NonNullable<PageShellProps['width']>, string> = {
  '5xl': 'max-w-5xl',
  '7xl': 'max-w-7xl',
  'full': 'max-w-full'
};

/**
 * Canonical page shell — see `.agent/memory/DESIGN.md`.
 * Provides: fixed neutral-950 background, centered main, sr-only h1,
 * BreadcrumbWithBack, title block with border-b, and telemetry data attrs.
 *
 * Use this instead of hand-rolling the shell in every page.
 */
export const PageShell: React.FC<PageShellProps> = ({
  pageId,
  componentName,
  seoTitle,
  seoDescription,
  seoKeywords,
  title,
  microTitle,
  description,
  breadcrumb,
  backTo,
  actions,
  width = '7xl',
  hideHeader = false,
  noBackground = false,
  contentClassName,
  children,
}) => {
  const ariaLabel = typeof title === 'string' ? title : pageId;
  const backTarget = backTo ?? breadcrumb?.[0]?.to;

  return (
    <div data-vsn-page={pageId} data-vsn-component={componentName ?? pageId}>
      {seoTitle && (
        <SEO title={seoTitle} description={seoDescription} keywords={seoKeywords} />
      )}

      {/* Background layer */}
      {!noBackground && (
        <div className="fixed inset-0 z-0 bg-neutral-950">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-cyan/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-brand-cyan/5 rounded-full blur-[100px] pointer-events-none" />
        </div>
      )}

      <div className="min-h-screen bg-transparent relative z-10">
        <main role="main" aria-label={ariaLabel} data-vsn-region="content">
          <div
            className={cn(
              'mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16',
              WIDTH_MAP[width],
              contentClassName,
            )}
          >
            {typeof title === 'string' && <h1 className="sr-only">{title}</h1>}

            {breadcrumb && breadcrumb.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <BreadcrumbWithBack to={backTarget}>
                  <BreadcrumbList>
                    {breadcrumb.map((seg, i) => {
                      const isLast = i === breadcrumb.length - 1;
                      return (
                        <React.Fragment key={`${seg.label}-${i}`}>
                          <BreadcrumbItem>
                            {isLast || !seg.to ? (
                              <BreadcrumbPage className="text-brand-cyan text-[10px] font-mono tracking-widest uppercase">
                                {seg.label}
                              </BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink asChild>
                                <Link
                                  to={seg.to}
                                  className="text-neutral-500 hover:text-neutral-200 transition-colors text-[10px] font-mono tracking-widest uppercase"
                                >
                                  {seg.label}
                                </Link>
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                          {!isLast && (
                            <BreadcrumbSeparator className="text-neutral-800" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </BreadcrumbList>
                </BreadcrumbWithBack>
              </div>
            )}

            {!hideHeader && (
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-10 mb-12">
                <div className="space-y-3">
                  {microTitle && (
                    <MicroTitle className="text-neutral-500">{microTitle}</MicroTitle>
                  )}
                  <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                    {title}
                  </h2>
                  {description && (
                    <p className="text-sm text-neutral-500 leading-relaxed max-w-xl">
                      {description}
                    </p>
                  )}
                </div>
                {actions && <div className="flex items-center gap-3">{actions}</div>}
              </div>
            )}

            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
