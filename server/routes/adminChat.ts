/**
 * /api/admin-chat — Chat Estratégico do admin.
 *
 * Wrapper fino: os handlers de sessão/mensagem/SSE/WS vivem em
 * services/chat/chatSessionHandlers.ts e são compartilhados com o
 * /api/copilot (routes/copilot.ts). Aqui só muda o guard (validateAdmin)
 * e o toolset (admin = tudo).
 */
import { validateAdmin } from '../middleware/adminAuth.js';
import { getChatTools } from '../services/chat/toolRegistry.js';
import { createChatSessionRouter } from '../services/chat/chatSessionHandlers.js';

// Re-exports para back-compat (server/index.ts e testes importam daqui)
export {
  stripAction,
  broadcastToSession,
  initAdminChatWebSocket,
} from '../services/chat/chatSessionHandlers.js';

const router = createChatSessionRouter({
  guard: validateAdmin,
  resolveTools: () => getChatTools(true),
  promptVariant: 'admin',
  logPrefix: '[AdminChat]',
});

export default router;
