import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Command } from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { transitions } from '@/lib/ui/motion';

/** Evento que abre o palette imperativamente (afford. externa, ex.: botão do topbar). */
export const COMMAND_PALETTE_OPEN_EVENT = 'vsn:command-palette-open';

/** Abre o Command Palette de qualquer lugar (sem prop drilling). */
export const openCommandPalette = () =>
  document.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));

interface SearchResult {
  id: string;
  label: string;
  category: string;
  /** Visual leading — shared component (BrandAvatar, ícone lucide da nav/app). */
  icon?: React.ReactNode;
  /** Acessório persistente à direita (✓ marca ativa, ↗ externo, badge…). */
  trailing?: React.ReactNode;
  /** Some da busca — grupos de atalho (Recentes / Fixados) só valem sem query. */
  hideOnSearch?: boolean;
  /** Drill-in: se presente, selecionar abre uma sub-página em vez de executar. */
  children?: SearchResult[];
  onClick?: () => void;
}

/** Nº de itens visíveis por seção antes do "mostrar mais" (só quando sem busca). */
const SECTION_LIMIT = 5;

interface CommandPaletteProps {
  items: SearchResult[];
  onClose?: () => void;
  /** Ação quando a busca não acha nada (ex.: "Perguntar ao Copilot: …"). */
  fallback?: (query: string) => SearchResult | null;
  /** Placeholder do input — cada caller descreve o que ESTA paleta busca. */
  placeholder?: string;
}

interface Group {
  category: string;
  entries: SearchResult[];
}

/** Agrupa por categoria preservando a ordem de primeira aparição (SSoT do caller). */
function groupByCategory(items: SearchResult[]): Group[] {
  const map = new Map<string, SearchResult[]>();
  for (const item of items) {
    const list = map.get(item.category);
    if (list) list.push(item);
    else map.set(item.category, [item]);
  }
  return Array.from(map, ([category, entries]) => ({ category, entries }));
}

/** Achata leaves p/ a busca — expande `children`, dropa atalhos e containers. */
function flattenLeaves(items: SearchResult[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const item of items) {
    if (item.hideOnSearch) continue;
    if (item.children?.length) out.push(...flattenLeaves(item.children));
    else out.push(item);
  }
  return out;
}

/**
 * Command palette (Cmd/Ctrl+K) — sobre `cmdk` (filtro fuzzy + navegação nativos)
 * dentro de um Radix `Dialog` (focus-trap, scroll-lock, aria-modal e return-focus
 * de graça), com `framer-motion` e tokens de tema (theme-aware, funciona em
 * light/dark). Suporta **drill-in pages** (`children`), **flatten na busca** (a
 * sub-lista continua pesquisável) e um **fallback** quando nada casa (→ Copilot).
 * Inspiração: Figma / Linear / Raycast.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  items,
  onClose,
  fallback,
  placeholder,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /** Pilha de drill-in — cada nível é uma sub-lista com título. */
  const [pages, setPages] = useState<{ title: string; items: SearchResult[] }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const isSearching = search.trim().length > 0;
  const currentPage = pages[pages.length - 1];

  const popPage = React.useCallback(() => {
    setPages((p) => p.slice(0, -1));
    setExpanded(new Set());
  }, []);

  // Ctrl/Cmd+K faz toggle; evento imperativo abre. (Esc/click-outside → Radix.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    const handleOpenEvent = () => setIsOpen(true);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpenEvent);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpenEvent);
    };
  }, []);

  // Reset + onClose numa única vez por fechamento, seja qual for o caminho.
  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      setSearch('');
      setExpanded(new Set());
      setPages([]);
      onClose?.();
    }
  }, [isOpen, onClose]);

  // View: buscando → flatten global (pages ignoradas); senão a página atual ou a raiz.
  const groups = useMemo(() => {
    if (isSearching) return groupByCategory(flattenLeaves(items));
    return groupByCategory(currentPage ? currentPage.items : items);
  }, [isSearching, items, currentPage]);

  const runFallback = () => {
    const fb = fallback?.(search.trim());
    if (fb) {
      fb.onClick?.();
      setIsOpen(false);
    }
  };

  const handleSelect = (item: SearchResult) => {
    if (item.children?.length) {
      setPages((p) => [...p, { title: item.label, items: item.children! }]);
      setSearch('');
      setExpanded(new Set());
      return;
    }
    item.onClick?.();
    setIsOpen(false);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transitions.fast}
              />
            </Dialog.Overlay>

            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                inputRef.current?.focus();
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 8 }}
                transition={transitions.base}
                className={cn(
                  'fixed z-50 mx-auto w-full overflow-hidden',
                  // mobile: bottom-sheet full-width; desktop: caixa centralizada
                  'inset-x-0 bottom-0 max-w-full rounded-t-2xl',
                  'sm:inset-x-0 sm:bottom-auto sm:top-[18vh] sm:max-w-xl sm:rounded-xl sm:px-0',
                  'border border-border bg-popover/90 shadow-2xl backdrop-blur-xl'
                )}
              >
                <Dialog.Title className="sr-only">
                  {t('command.title') || 'Command palette'}
                </Dialog.Title>

                <Command
                  loop
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !search && pages.length > 0) {
                      e.preventDefault();
                      popPage();
                    } else if (
                      e.key === 'Enter' &&
                      isSearching &&
                      fallback &&
                      !listRef.current?.querySelector('[cmdk-item]')
                    ) {
                      // Nada casou → Enter dispara o fallback (ir pro Copilot).
                      e.preventDefault();
                      runFallback();
                    }
                  }}
                  className="flex flex-col"
                >
                  {/* Search + breadcrumb do drill-in */}
                  <div className="flex items-center gap-2 border-b border-border px-4">
                    {pages.length > 0 && !isSearching ? (
                      <button
                        type="button"
                        onClick={popPage}
                        className="flex shrink-0 items-center gap-1 rounded-md py-1 pl-1 pr-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span className="max-w-[10rem] truncate">{currentPage?.title}</span>
                      </button>
                    ) : (
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <Command.Input
                      ref={inputRef}
                      value={search}
                      onValueChange={setSearch}
                      placeholder={
                        placeholder ||
                        t('designSystem.commandPalette.placeholder') ||
                        'Search components, colors, typography...'
                      }
                      className="flex-1 bg-transparent py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    <kbd className="hidden select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
                      ESC
                    </kbd>
                  </div>

                  {/* Results */}
                  <Command.List
                    ref={listRef}
                    className="max-h-[60vh] overflow-y-auto overscroll-contain p-2 sm:max-h-[52vh]"
                  >
                    <Command.Empty className="px-2 py-6">
                      {isSearching && fallback ? (
                        <FallbackRow fb={fallback(search.trim())} onRun={runFallback} />
                      ) : (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          {t('designSystem.commandPalette.noResults') || 'No results found'}
                        </div>
                      )}
                    </Command.Empty>

                    {groups.map(({ category, entries }) => {
                      // Sem busca: mostra só os primeiros N; ao buscar, mostra tudo
                      // (senão o filtro fuzzy do cmdk esconderia matches colapsados).
                      const showAll = isSearching || expanded.has(category);
                      const visible = showAll ? entries : entries.slice(0, SECTION_LIMIT);
                      const hidden = entries.length - visible.length;

                      return (
                        <Command.Group
                          key={category}
                          heading={category}
                          className={cn(
                            'mb-1 last:mb-0',
                            '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2',
                            '[&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px]',
                            '[&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase',
                            '[&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground'
                          )}
                        >
                          {visible.map((item, i) => (
                            <PaletteItem
                              key={item.id}
                              item={item}
                              onSelect={() => handleSelect(item)}
                              selectHint={t('command.hintSelect') || 'Selecionar'}
                              animateIn={!isSearching && i >= SECTION_LIMIT}
                            />
                          ))}

                          {/* Mostrar mais — arrow sutil no final da seção (só sem busca) */}
                          {hidden > 0 && (
                            <Command.Item
                              value={`__more__${category}`}
                              onSelect={() => setExpanded((prev) => new Set(prev).add(category))}
                              className={cn(
                                'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground',
                                'transition-colors data-[selected=true]:bg-accent/60 data-[selected=true]:text-foreground'
                              )}
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                                <ChevronDown className="h-3.5 w-3.5" />
                              </span>
                              <span>
                                {t('command.showMore') || 'Mostrar mais'} ({hidden})
                              </span>
                            </Command.Item>
                          )}
                        </Command.Group>
                      );
                    })}
                  </Command.List>

                  {/* Footer — dicas de teclado (Figma / Linear style) */}
                  <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <KbdIcon>
                        <ArrowUp className="h-3 w-3" />
                      </KbdIcon>
                      <KbdIcon>
                        <ArrowDown className="h-3 w-3" />
                      </KbdIcon>
                      {t('command.hintNavigate') || 'Navegar'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <KbdIcon>
                        <CornerDownLeft className="h-3 w-3" />
                      </KbdIcon>
                      {t('command.hintSelect') || 'Selecionar'}
                    </span>
                    {pages.length > 0 && (
                      <span className="ml-auto hidden items-center gap-1.5 sm:flex">
                        <KbdIcon>
                          <ChevronLeft className="h-3 w-3" />
                        </KbdIcon>
                        {t('command.hintBack') || 'Voltar'}
                      </span>
                    )}
                  </div>
                </Command>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};

/** Fallback (empty state) — linha clicável "Perguntar ao Copilot: '<query>'". */
const FallbackRow: React.FC<{ fb: SearchResult | null; onRun: () => void }> = ({ fb, onRun }) => {
  if (!fb) return null;
  return (
    <button
      type="button"
      onClick={onRun}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {fb.icon && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
          {fb.icon}
        </span>
      )}
      <span className="truncate">{fb.label}</span>
      <kbd className="ml-auto flex shrink-0 items-center pl-2">
        <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
      </kbd>
    </button>
  );
};

/** Linha do palette — ícone leading, label, acessório, e hint ↵ no selecionado. */
const PaletteItem: React.FC<{
  item: SearchResult;
  onSelect: () => void;
  selectHint: string;
  animateIn?: boolean;
}> = ({ item, onSelect, selectHint, animateIn }) => {
  const isPage = !!item.children?.length;
  // Union motion.div | 'div' atrita no TS; `any` aqui é intencional e local.
  const Row: any = animateIn ? motion.div : 'div';
  const rowMotion = animateIn
    ? {
        initial: { opacity: 0, y: -4 },
        animate: { opacity: 1, y: 0 },
        transition: transitions.fast,
      }
    : {};

  return (
    <Command.Item
      value={`${item.label} ${item.category}`}
      keywords={[item.category]}
      onSelect={onSelect}
      className={cn(
        'cursor-pointer rounded-lg text-sm text-foreground/80',
        'transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground'
      )}
    >
      <Row className="flex items-center gap-2.5 px-2.5 py-2" {...rowMotion}>
        {item.icon && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground [[data-selected=true]_&]:text-foreground">
            {item.icon}
          </span>
        )}
        <span className="truncate">{item.label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          {item.trailing}
          {isPage ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 [[data-selected=true]_&]:text-foreground" />
          ) : (
            <kbd
              aria-label={selectHint}
              className="flex items-center opacity-0 transition-opacity [[data-selected=true]_&]:opacity-100"
            >
              <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
            </kbd>
          )}
        </span>
      </Row>
    </Command.Item>
  );
};

const KbdIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="flex h-5 w-5 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
    {children}
  </kbd>
);
