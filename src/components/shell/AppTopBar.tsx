/**
 * Top bar do AppShell (dashboards). Fina camada sobre a AppSpine — a espinha
 * única do app. Mantido como componente próprio porque o AppShell o monta pelo
 * nome; a lógica vive na AppSpine (plano APP-SPINE-CONSOLIDATION).
 */
import React from 'react';
import { AppSpine } from './AppSpine';

interface AppTopBarProps {
  /** Abre o drawer de navegação no mobile. */
  onMenuClick?: () => void;
}

export const AppTopBar: React.FC<AppTopBarProps> = ({ onMenuClick }) => (
  <AppSpine variant="full" onMenuClick={onMenuClick} />
);
