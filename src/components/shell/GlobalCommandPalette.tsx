import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { useTranslation } from '@/hooks/useTranslation';
import { FEATURE_COPILOT } from '@/config/featureFlags';
import { useShellCommands } from './useShellCommands';

/**
 * Cmd+K global do AppShell. Monta o `CommandPalette` com os comandos do SSoT
 * navConfig (`useShellCommands`) + um fallback pro Copilot quando a busca não acha
 * nada (padrão Raycast/Linear). Montado uma vez no AppShell → vale em qualquer rota.
 */
export const GlobalCommandPalette: React.FC = () => {
  const items = useShellCommands();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const fallback = FEATURE_COPILOT
    ? (query: string) => ({
        id: 'copilot-fallback',
        label: t('command.askCopilot', { query }) || `Perguntar ao Copilot: "${query}"`,
        category: '',
        icon: <Sparkles className="h-4 w-4" />,
        onClick: () => navigate(`/copilot?prompt=${encodeURIComponent(query)}`),
      })
    : undefined;

  return <CommandPalette items={items} fallback={fallback} />;
};
