import React from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from '@/lib/ui/icons';

/**
 * ToolDock — primitiva SSoT do "dock de ferramentas" flutuante (pill).
 *
 * Puramente apresentacional e por composição: cada feature (canvas, creative,
 * …) alimenta seus próprios `ToolButton`s e popovers. NÃO carrega tool-model,
 * atalhos ou estado — isso é responsabilidade de quem usa. Serve só o visual +
 * o comportamento comum (pill, active/hover, tooltip, tema claro/escuro).
 *
 * Extraído de `CanvasBottomToolbar` (a implementação mais madura). O inspector
 * contextual de seleção (`CreativeToolbar`/`BackgroundToolbar`) é OUTRO conceito
 * e continua separado — dock de ferramentas ≠ barra de propriedades.
 */

export interface ToolDockTheme {
  /** Cor de fundo base do pill (hex sem alpha; o alpha é aplicado internamente). */
  bg: string;
  /** Cor de texto/ícone principal (hover / ativo neutro). */
  primary: string;
  /** Cor de texto/ícone em repouso. */
  muted: string;
  isLight: boolean;
}

export const DARK_TOOL_DOCK_THEME: ToolDockTheme = {
  bg: '#0a0a0a',
  primary: '#fafafa',
  muted: '#a1a1a1',
  isLight: false,
};

interface ToolDockContextValue {
  theme: ToolDockTheme;
  tooltipPosition: 'top' | 'bottom';
}

const ToolDockContext = React.createContext<ToolDockContextValue>({
  theme: DARK_TOOL_DOCK_THEME,
  tooltipPosition: 'top',
});

interface ToolDockProps {
  children: React.ReactNode;
  /** Onde o dock fica → controla a direção do tooltip (bottom dock → tooltip em cima). */
  position?: 'top' | 'bottom';
  theme?: ToolDockTheme;
  /** Classe do wrapper externo (posicionamento: fixed/absolute + centralização). */
  className?: string;
}

export const ToolDock = React.forwardRef<HTMLDivElement, ToolDockProps>(
  ({ children, position = 'bottom', theme = DARK_TOOL_DOCK_THEME, className }, ref) => (
    <ToolDockContext.Provider
      value={{ theme, tooltipPosition: position === 'bottom' ? 'top' : 'bottom' }}
    >
      <div ref={ref} className={cn('z-50', className)}>
        <div
          className={cn(
            'flex items-center gap-1 backdrop-blur-xl border rounded-xl px-2 py-1.5 shadow-lg',
            theme.isLight ? 'border-neutral-300/50' : 'border-neutral-800/50'
          )}
          style={{
            backgroundColor: theme.isLight ? `${theme.bg}ee` : `${theme.bg}dd`,
            color: theme.primary,
          }}
        >
          {children}
        </div>
      </div>
    </ToolDockContext.Provider>
  )
);
ToolDock.displayName = 'ToolDock';

export const ToolDockDivider: React.FC = () => {
  const { theme } = React.useContext(ToolDockContext);
  return (
    <div
      className={cn('w-px h-5 mx-0.5', theme.isLight ? 'bg-neutral-300/50' : 'bg-neutral-800/50')}
    />
  );
};

interface ToolButtonProps {
  icon: LucideIcon;
  tooltip: string;
  ariaLabel?: string;
  active?: boolean;
  disabled?: boolean;
  /** Ponto de cor no canto (ex.: tool de cor mostra o stroke atual). */
  badgeColor?: string;
  variant?: 'default' | 'brand';
  iconClassName?: string;
  onClick?: () => void;
  /**
   * Popover/menu desta ferramenta. Renderizado como irmão do botão dentro de um
   * wrapper `relative` — o conteúdo se posiciona sozinho (`absolute bottom-full…`
   * num dock de baixo, `top-full…` num de cima).
   */
  children?: React.ReactNode;
}

export const ToolButton: React.FC<ToolButtonProps> = ({
  icon: Icon,
  tooltip,
  ariaLabel,
  active,
  disabled,
  badgeColor,
  variant = 'default',
  iconClassName,
  onClick,
  children,
}) => {
  const { theme, tooltipPosition } = React.useContext(ToolDockContext);
  return (
    <div className="relative">
      <Tooltip content={tooltip} position={tooltipPosition}>
        <Button
          variant={variant === 'brand' ? 'brand' : 'ghost'}
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel || tooltip}
          className={cn(
            'relative w-10 h-10 flex items-center justify-center rounded-md transition-colors duration-150',
            'focus:outline-none focus:ring-1 focus:ring-neutral-500/50',
            disabled && 'opacity-40 pointer-events-none',
            active
              ? 'bg-brand-cyan/20'
              : theme.isLight
                ? 'hover:bg-neutral-200/50'
                : 'hover:bg-neutral-800/50'
          )}
          style={{ color: active ? 'var(--brand-cyan)' : theme.muted }}
          onMouseEnter={(e) => {
            if (!active && !disabled) e.currentTarget.style.color = theme.primary;
          }}
          onMouseLeave={(e) => {
            if (!active && !disabled) e.currentTarget.style.color = theme.muted;
          }}
        >
          <Icon size={18} strokeWidth={2} className={iconClassName} />
          {badgeColor && (
            <div
              className="absolute bottom-1 left-1 w-2.5 h-2.5 rounded-full border border-neutral-700"
              style={{ backgroundColor: badgeColor }}
            />
          )}
        </Button>
      </Tooltip>
      {children}
    </div>
  );
};
