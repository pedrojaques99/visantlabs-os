/**
 * SSoT de estilo dos sidebars do app (plano APP-SHELL, consolidação).
 *
 * Tokens + primitivos compartilhados para que TODO sidebar (rail global, lista
 * de marcas, painéis de navegação) use o mesmo léxico visual: tokens semânticos
 * theme-aware, mesma tipografia de section-label, mesmo item/hover/active, mesma
 * busca. Antes cada sidebar hardcodava neutrals (`text-neutral-500`,
 * `bg-white/[0.03]`, `border-neutral-800`) — inconsistente entre si e com o rail.
 *
 * Uso: importe os tokens (`sb`) para className, ou os primitivos
 * (`SidebarSectionLabel`, `SidebarItem`) para markup pronto.
 */
import React from 'react';
import { Search, X } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';

// Usa a família de tokens shadcn `--sidebar-*` (superfície/foreground/accent/
// border próprios, com valores light/dark) — o token canônico de sidebar.
// Evita `--sidebar-primary` (roxo default do shadcn, destoa do app) usando
// `--sidebar-accent` (neutro) para os estados ativos.
export const sb = {
  /** Container raiz de um sidebar contido (dentro do AppShell/two-pane). */
  container: 'flex flex-col h-full bg-sidebar text-sidebar-foreground overflow-y-auto',
  /** Container com borda à direita (pane de lista ao lado do conteúdo). */
  containerBordered:
    'flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border overflow-y-auto',
  /** Rótulo de seção (mono, uppercase, discreto). */
  sectionLabel:
    'px-2.5 py-1 text-2xs font-mono uppercase tracking-wider text-sidebar-foreground/50',
  /** Item de navegação — estado ocioso. */
  item: 'w-full min-w-0 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  /** Item ativo (destino atual). */
  itemActive: 'bg-sidebar-accent text-sidebar-accent-foreground',
  /** Item primário ativo (destino de nível 1). */
  itemActivePrimary: 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
  /** Input de busca do sidebar. */
  searchInput:
    'h-8 pl-8 text-xs bg-sidebar-accent/40 border-sidebar-border placeholder:text-sidebar-foreground/40',
  /** Chip de filtro — ocioso / ativo. */
  chip: 'flex items-center gap-1 px-2 py-1 rounded-md text-2xs border transition-colors',
  chipIdle:
    'border-transparent text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent',
  chipActive: 'bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground',
} as const;

/** Rótulo de seção padronizado. */
export const SidebarSectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={cn(sb.sectionLabel, className)}>{children}</div>;

/** Item de navegação padronizado. */
export const SidebarItem: React.FC<{
  active?: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ active, onClick, title, children, className }) => (
  <button
    onClick={onClick}
    title={title}
    className={cn(sb.item, active && sb.itemActive, className)}
  >
    {children}
  </button>
);

/** Busca padronizada do sidebar (input + clear). */
export const SidebarSearch: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => (
  <div className={cn('relative', className)}>
    <Search
      size={13}
      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
    />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full rounded-md border outline-none focus:ring-1 focus:ring-ring',
        sb.searchInput,
        value && 'pr-8'
      )}
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="clear"
      >
        <X size={12} />
      </button>
    )}
  </div>
);
