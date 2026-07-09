// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBrandFilter } from '@/hooks/useBrandFilter';

describe('useBrandFilter', () => {
  beforeEach(() => localStorage.clear());

  it('default é desligado quando não há preferência salva', () => {
    const { result } = renderHook(() => useBrandFilter('k'));
    expect(result.current.enabled).toBe(false);
  });

  it('toggle liga e persiste no localStorage', () => {
    const { result } = renderHook(() => useBrandFilter('k'));
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem('k')).toBe('1');
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem('k')).toBe('0');
  });

  it('lê a preferência persistida no mount', () => {
    localStorage.setItem('k2', '1');
    const { result } = renderHook(() => useBrandFilter('k2'));
    expect(result.current.enabled).toBe(true);
  });

  it('brandId é null sem marca ativa, mesmo ligado (fora do provider)', () => {
    localStorage.setItem('k3', '1');
    const { result } = renderHook(() => useBrandFilter('k3'));
    expect(result.current.enabled).toBe(true);
    expect(result.current.activeBrand).toBeNull();
    expect(result.current.brandId).toBeNull();
  });

  it('chaves independentes não vazam entre listas', () => {
    const a = renderHook(() => useBrandFilter('canvas'));
    act(() => a.result.current.toggle());
    const b = renderHook(() => useBrandFilter('creative'));
    expect(b.result.current.enabled).toBe(false);
  });
});
