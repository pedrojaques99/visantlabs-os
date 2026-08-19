import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Rótulo de seção.
 *
 * Era mono + CAIXA-ALTA + 12px + tracking, em 260 call sites de 77 arquivos.
 * Esse conjunto é a assinatura visual de dashboard gerado por IA em 2026, e
 * medindo o app ele aparecia 593 vezes: virava textura, não hierarquia. A tela
 * do app que o fundador aponta como a melhor (`BrandGuidelinesPage`) usa ZERO
 * deles — ela titula seção com heading de verdade no sans.
 *
 * Então o padrão inverteu: `tone="section"` (default) é heading de verdade.
 *
 * `tone="technical"` preserva o visual antigo e continua CERTO em rótulo
 * técnico de verdade: unidade, chave de token, coluna de dado bruto, cabeçalho
 * de tabela de debug. Mono ali carrega significado (largura fixa, "isto é um
 * valor"), não decoração. O que não vale é usar técnico porque o antigo era
 * assim.
 */
export interface MicroTitleProps extends React.AllHTMLAttributes<HTMLElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'p' | 'label';
  tone?: 'section' | 'technical';
}

const TONE = {
  section: 'text-sm font-medium tracking-tight text-foreground text-left',
  technical: 'font-mono text-xs uppercase tracking-[0.02em] text-muted-foreground text-left',
} as const;

export const MicroTitle = React.forwardRef<HTMLElement, MicroTitleProps>(
  ({ className, as: Component = 'span', tone = 'section', children, ...props }, ref) => {
    return (
      <Component ref={ref as any} className={cn(TONE[tone], className)} {...props}>
        {children}
      </Component>
    );
  }
);
MicroTitle.displayName = 'MicroTitle';
