/**
 * Marca ativa global (plano APP-SHELL-REALIGNMENT, F0 / gap #5).
 *
 * SSoT page-agnostic da "marca ativa" do app — antes fragmentada entre o
 * `BrandCockpit` (useState local + localStorage) e o `BrandKitContext`
 * (canvas-scoped, derivado do `linkedGuidelineId`). Este provider é montado
 * acima das rotas e alimenta o BrandSwitcher do rail e qualquer página que
 * precise saber "qual marca o usuário está operando".
 *
 * Persiste na MESMA chave que o cockpit já usava (`vsn_active_brand`), que
 * passa a ser a fonte única. O cockpit consome este contexto (F2) em vez de
 * gerir o estado localmente.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { isBrandScopedEditor } from '@/config/navConfig';
import type { BrandGuideline } from '@/lib/figma-types';

/** Chave de persistência — herdada do BrandCockpit (SSoT). */
export const ACTIVE_BRAND_LS_KEY = 'vsn_active_brand';
/** MRU de marcas visitadas (mais-recente-primeiro) — alimenta RECENTES no rail. */
const RECENT_BRANDS_LS_KEY = 'vsn_recent_brands';
const RECENT_CAP = 8;

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_BRANDS_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface ActiveBrandContextValue {
  /** Id da marca ativa (persistido), ou null quando não há marca selecionável. */
  activeBrandId: string | null;
  /** A marca ativa resolvida da lista (não-arquivada), ou null. */
  activeBrand: BrandGuideline | null;
  /** Marcas ativas (não-arquivadas) — o que o switcher lista. */
  brands: BrandGuideline[];
  /** Lista bruta (inclui arquivadas), para telas que precisem do todo. */
  allBrands: BrandGuideline[];
  /** true quando o usuário escolheu "Todas as marcas" (sem escopo de marca). */
  isAllBrands: boolean;
  /** Troca a marca ativa. `null` = "Todas as marcas" (sem escopo). */
  setActiveBrand: (id: string | null) => void;
  /** Ids de marcas visitadas recentemente (MRU, mais-recente-primeiro). */
  recentBrandIds: string[];
  isLoading: boolean;
}

const ActiveBrandContext = createContext<ActiveBrandContextValue | null>(null);

function hasAuthToken(): boolean {
  return typeof window !== 'undefined' && !!localStorage.getItem('auth_token');
}

export const ActiveBrandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Query gated no token (otimista, igual ao Layout) para não disparar 401 em
  // visitante deslogado — o provider é seguro de montar acima das rotas.
  const { data: allBrands = [], isLoading } = useBrandGuidelines(hasAuthToken());

  const brands = useMemo(() => allBrands.filter((g) => g.status !== 'archived'), [allBrands]);

  const [activeBrandId, setActiveBrandId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_BRAND_LS_KEY) || null;
  });

  // "Todas as marcas" (null intencional). Em memória (não persistido): ao
  // recarregar, o usuário cai numa marca real de novo — "todas" é uma visão
  // transitória de lista, não um estado default do app.
  const [isAllBrands, setIsAllBrands] = useState(false);

  // Mantém o id válido: se o atual sumiu (ou nunca existiu), cai numa marca
  // real preferindo não-demo — mesma regra do cockpit original. NÃO força
  // fallback quando o usuário escolheu "Todas as marcas".
  useEffect(() => {
    if (brands.length === 0) return;
    if (isAllBrands) return;
    const stillValid = activeBrandId && brands.some((g) => g.id === activeBrandId);
    if (!stillValid) {
      const fallback = brands.find((g) => !g.isDemo) ?? brands[0];
      if (fallback?.id) {
        setActiveBrandId(fallback.id);
        localStorage.setItem(ACTIVE_BRAND_LS_KEY, fallback.id);
      }
    }
  }, [brands, activeBrandId, isAllBrands]);

  // "Todas as marcas" é uma visão de LISTA (filtro). Ao entrar num editor que
  // PRODUZ para uma marca (guideline = INPUT), resolve numa marca concreta —
  // senão o chip fica em branco e a geração roda sem contexto de marca.
  const location = useLocation();
  useEffect(() => {
    if (!isAllBrands || brands.length === 0) return;
    if (!isBrandScopedEditor(location.pathname)) return;
    const pick = brands.find((g) => !g.isDemo) ?? brands[0];
    if (pick?.id) {
      setIsAllBrands(false);
      setActiveBrandId(pick.id);
      if (typeof window !== 'undefined') localStorage.setItem(ACTIVE_BRAND_LS_KEY, pick.id);
    }
  }, [location.pathname, isAllBrands, brands]);

  const [recentBrandIds, setRecentBrandIds] = useState<string[]>(() => readRecent());

  const setActiveBrand = useCallback((id: string | null) => {
    // null = "Todas as marcas" — sem escopo de marca (não persiste; ver acima).
    if (id === null) {
      setIsAllBrands(true);
      setActiveBrandId(null);
      if (typeof window !== 'undefined') localStorage.removeItem(ACTIVE_BRAND_LS_KEY);
      return;
    }
    setIsAllBrands(false);
    setActiveBrandId(id);
    setRecentBrandIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_CAP);
      if (typeof window !== 'undefined')
        localStorage.setItem(RECENT_BRANDS_LS_KEY, JSON.stringify(next));
      return next;
    });
    if (typeof window !== 'undefined') localStorage.setItem(ACTIVE_BRAND_LS_KEY, id);
  }, []);

  const activeBrand = useMemo(
    () => brands.find((g) => g.id === activeBrandId) ?? null,
    [brands, activeBrandId]
  );

  const value = useMemo<ActiveBrandContextValue>(
    () => ({
      activeBrandId,
      activeBrand,
      brands,
      allBrands,
      isAllBrands,
      setActiveBrand,
      recentBrandIds,
      isLoading,
    }),
    [
      activeBrandId,
      activeBrand,
      brands,
      allBrands,
      isAllBrands,
      setActiveBrand,
      recentBrandIds,
      isLoading,
    ]
  );

  return <ActiveBrandContext.Provider value={value}>{children}</ActiveBrandContext.Provider>;
};

/** Lança fora do provider — use em telas garantidamente dentro do AppShell. */
export function useActiveBrand(): ActiveBrandContextValue {
  const ctx = useContext(ActiveBrandContext);
  if (!ctx) throw new Error('useActiveBrand must be used within ActiveBrandProvider');
  return ctx;
}

/** Versão segura (retorna null fora do provider) — para componentes que podem
 *  renderizar fora da árvore do app (ex.: shells públicos). */
export function useActiveBrandSafe(): ActiveBrandContextValue | null {
  return useContext(ActiveBrandContext);
}
