import React from 'react';
import { Link } from 'react-router-dom';
import { GridDotsBackground } from './GridDotsBackground';
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
import { useInAppShell } from '../shell/InAppShellContext';

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
  full: 'max-w-full',
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
  // Dentro do AppShell o rail + top bar já são o chrome: o fundo vira `absolute`
  // (contido no <main relative>, não cobre o rail), a altura acompanha o main e
  // o padding-top encolhe (não há mais Header por cima). Plano P1.
  const inShell = useInAppShell();

  return (
    <div data-vsn-page={pageId} data-vsn-component={componentName ?? pageId}>
      {seoTitle && <SEO title={seoTitle} description={seoDescription} keywords={seoKeywords} />}

      {/* Background layer */}
      {!noBackground && (
        <div className={cn('inset-0 z-0 bg-neutral-950', inShell ? 'absolute' : 'fixed')}>
          <GridDotsBackground />
        </div>
      )}

      <div className={cn('bg-transparent relative z-10', inShell ? 'min-h-full' : 'min-h-screen')}>
        <main role="main" aria-label={ariaLabel} data-vsn-region="content">
          <div
            className={cn(
              'mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-16',
              inShell ? 'pt-6 sm:pt-8' : 'pt-14 sm:pt-20',
              WIDTH_MAP[width],
              contentClassName
            )}
          >
            {typeof title === 'string' && <h1 className="sr-only">{title}</h1>}

            {!inShell && breadcrumb && breadcrumb.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <BreadcrumbWithBack to={backTarget}>
                  <BreadcrumbList>
                    {breadcrumb.map((seg, i) => {
                      const isLast = i === breadcrumb.length - 1;
                      return (
                        <React.Fragment key={`${seg.label}-${i}`}>
                          <BreadcrumbItem>
                            {isLast || !seg.to ? (
                              <BreadcrumbPage className="text-neutral-200 text-[11px] sm:text-[10px] font-mono tracking-widest uppercase">
                                {seg.label}
                              </BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink asChild>
                                <Link
                                  to={seg.to}
                                  className="text-neutral-500 hover:text-neutral-200 transition-colors text-[11px] sm:text-[10px] font-mono tracking-widest uppercase"
                                >
                                  {seg.label}
                                </Link>
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                          {!isLast && <BreadcrumbSeparator className="text-neutral-800" />}
                        </React.Fragment>
                      );
                    })}
                  </BreadcrumbList>
                </BreadcrumbWithBack>
              </div>
            )}

            {!hideHeader && (
              // Dentro do AppShell o AppTopBar já carrega a identidade da página:
              // o header vira uma linha compacta (sem micro-título decorativo,
              // título menor, espaçamento apertado) e devolve o espaço vertical.
              <div
                className={cn(
                  'flex flex-col md:flex-row md:items-end justify-between',
                  inShell
                    ? 'gap-2 border-b border-border pb-3 mb-5'
                    : 'gap-4 sm:gap-6 border-b border-white/10 pb-6 sm:pb-10 mb-8 sm:mb-12'
                )}
              >
                <div className={cn(inShell ? 'space-y-1' : 'space-y-3')}>
                  {microTitle && !inShell && (
                    <MicroTitle className="text-neutral-500">{microTitle}</MicroTitle>
                  )}
                  <h2
                    className={cn(
                      'font-bold text-foreground tracking-tight',
                      inShell ? 'text-lg' : 'text-2xl lg:text-3xl text-white'
                    )}
                  >
                    {title}
                  </h2>
                  {description && (
                    <p
                      className={cn(
                        'text-muted-foreground leading-relaxed max-w-xl',
                        inShell ? 'text-xs' : 'text-sm text-neutral-500'
                      )}
                    >
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
