/**
 * BrandSectionNav — single dynamic navigation for the brand guideline view.
 *
 * One component, two states driven by `collapsed`:
 *  - top (default, hero in view): floating pill with search + horizontal tabs.
 *  - collapsed (scrolled past hero): the top pill fades out and a fixed left
 *    sidebar rail takes over, with the search collapsed to an expandable icon.
 *
 * Both states map the SAME `tabs` (PUBLIC_TABS → visibleTabs), so the section
 * list stays a single source of truth — no duplicated nav definitions.
 */
import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { GlassPanel } from '@/components/ui/GlassPanel';
import type { PublicTab } from './brand-shared-config';

interface BrandSectionNavProps {
  tabs: PublicTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  /** True once the hero has scrolled out of view. */
  collapsed: boolean;
  searchPlaceholder?: string;
  sectionsLabel?: string;
}

export const BrandSectionNav: React.FC<BrandSectionNavProps> = ({
  tabs,
  activeTab,
  onTabChange,
  searchTerm,
  onSearchChange,
  collapsed,
  searchPlaceholder,
  sectionsLabel,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);

  const tabButton = (tab: PublicTab, variant: 'mobile' | 'desktop') => (
    <button
      key={tab.id}
      onClick={() => onTabChange(tab.id)}
      aria-current={activeTab === tab.id ? 'true' : undefined}
      className={cn(
        'rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all',
        variant === 'mobile' ? 'px-3 py-1.5 whitespace-nowrap shrink-0' : 'px-4 py-2',
        activeTab === tab.id
          ? 'bg-[var(--accent)] text-[var(--accent-text)]'
          : 'opacity-40 hover:opacity-100 hover:bg-[var(--brand-text)]/5'
      )}
    >
      {tab.label}
    </button>
  );

  return (
    <>
      {/* TOP — search + tabs; fades out when collapsed */}
      <div
        className={cn(
          'sticky top-6 z-40 mb-16 px-2 transition-all duration-500',
          collapsed ? '-translate-y-6 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        )}
      >
        <GlassPanel
          padding="sm"
          className="backdrop-blur-2xl transition-all duration-500 bg-[var(--brand-bg)]/30 border-[var(--brand-text)]/8 shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-[var(--brand-text)]/5"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--brand-text)] opacity-60"
                size={16}
              />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 h-11 bg-transparent border-none focus-visible:ring-0 text-sm text-[var(--brand-text)] placeholder:text-[var(--brand-text)] placeholder:opacity-60"
              />
            </div>

            {/* Mobile tab selector */}
            <div className="md:hidden border-t border-[var(--brand-text)]/10 pt-3 flex gap-1 overflow-x-auto scrollbar-none">
              {tabs.map((tab) => tabButton(tab, 'mobile'))}
            </div>

            {/* Desktop tabs */}
            <div className="hidden md:flex items-center gap-1 border-l border-[var(--brand-text)]/10 pl-4">
              {tabs.map((tab) => tabButton(tab, 'desktop'))}
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* SIDEBAR — appears when collapsed; owns its own expandable search */}
      <nav
        aria-label={sectionsLabel}
        className={cn(
          'fixed left-8 top-1/2 -translate-y-1/2 z-50 hidden xl:flex flex-col gap-4 transition-all duration-500',
          collapsed
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 -translate-x-4 pointer-events-none'
        )}
      >
        {/* Expandable search */}
        <div className="flex items-center h-7">
          {searchOpen ? (
            <div className="relative flex items-center">
              <Search
                size={12}
                className="absolute left-2.5 text-[var(--brand-text)] opacity-50"
                aria-hidden="true"
              />
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
                onBlur={() => !searchTerm && setSearchOpen(false)}
                placeholder={searchPlaceholder}
                className="w-48 h-7 pl-7 pr-7 rounded-full bg-[var(--brand-bg)]/60 backdrop-blur-md border border-[var(--brand-text)]/10 text-[11px] text-[var(--brand-text)] placeholder:opacity-40 focus:outline-none focus:border-[var(--accent)]/40"
              />
              <button
                onClick={() => {
                  onSearchChange('');
                  setSearchOpen(false);
                }}
                aria-label="Close search"
                className="absolute right-2 text-[var(--brand-text)] opacity-50 hover:opacity-100"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                searchTerm
                  ? 'text-[var(--accent)]'
                  : 'opacity-50 hover:opacity-100 text-[var(--brand-text)]'
              )}
            >
              <Search size={13} />
            </button>
          )}
        </div>

        {tabs.map((tab) => (
          <button
            key={tab.id}
            aria-current={activeTab === tab.id ? 'true' : undefined}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'group flex items-center gap-3 transition-all duration-300',
              activeTab === tab.id ? 'translate-x-2' : 'opacity-60 hover:opacity-100'
            )}
          >
            <div
              aria-hidden="true"
              className={cn(
                'w-1 h-1 rounded-full transition-all duration-300',
                activeTab === tab.id
                  ? 'h-6 bg-[var(--accent)] shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]'
                  : 'bg-current opacity-20 group-hover:opacity-60'
              )}
            />
            <span className="text-[10px] uppercase font-bold tracking-wider font-mono opacity-80 group-hover:opacity-100 transition-opacity">
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
    </>
  );
};
