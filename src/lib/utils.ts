import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Título de seção do mockup: mesmo tamanho e estilo em ARQUIVOS, IDENTIDADE, PALETA, INSTRUÇÕES, etc. */
export const sectionTitleClass = (isDark: boolean) =>
  `text-[11px] font-mono uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`
