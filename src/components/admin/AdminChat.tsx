import React from 'react';
import { Shield } from '@/lib/ui/icons';
import { ChatShell, type ChatShellStrings } from '@/components/shared/chat/ChatShell';
import { adminChatApi } from '@/services/adminChatApi';

interface AdminChatProps {
  mode?: 'modal' | 'inline';
  isOpen?: boolean;
  onClose?: () => void;
}

// Copy histórica do Admin Chat mantida verbatim — o shell foi extraído para
// o Brand Copilot reusar a mesma UI sem alterar a experiência do admin.
const ADMIN_STRINGS: ChatShellStrings = {
  sidebarLabel: 'Admin',
  welcome:
    'Olá Administrador. Sou seu Assistente Estratégico de Agência. Estou aqui para ajudar com posicionamento, naming, estratégia e análise profunda. Você pode vincular este chat a uma Brand Guideline para contexto extra ou subir documentos estratégicos.',
  newSession: 'Nova sessão estratégica iniciada. Como posso ajudar com sua marca hoje?',
  sessionLoaded: 'Sessão carregada. Como deseja prosseguir?',
  selectSession: 'Bem-vindo ao Chat Estratégico Admin. Selecione uma sessão ou inicie uma nova.',
  inputPlaceholder: 'Digite sua consulta estratégica...',
};

export const AdminChat: React.FC<AdminChatProps> = ({
  mode = 'inline',
  isOpen = true,
  onClose,
}) => {
  return (
    <ChatShell
      mode={mode}
      isOpen={isOpen}
      onClose={onClose}
      api={adminChatApi}
      wsPath="/admin-chat/ws"
      sessionsQueryKey="admin-chat-sessions"
      feature="admin-chat"
      sidebarIcon={<Shield className="h-4 w-4 text-neutral-400" />}
      strings={ADMIN_STRINGS}
    />
  );
};
