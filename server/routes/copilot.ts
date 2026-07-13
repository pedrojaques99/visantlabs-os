/**
 * /api/copilot — Brand Copilot (Fase 1 do revenue-centric realignment).
 *
 * Mesmos handlers do admin chat (services/chat/chatSessionHandlers.ts), mas:
 * - guard: validateSubscriber (assinatura ativa OU admin) → 403 com
 *   { reason: 'subscription_required', upgradeUrl } para o front renderizar upsell
 * - toolset resolvido por tier: assinante = public + paid; admin = tudo
 * - system prompt na variante 'copilot' (sem framing interno de admin)
 *
 * Créditos: as tool calls de geração fazem loopback em /api/mockups/generate
 * com o JWT do usuário — a dedução via CREDIT_COSTS/deductCreditsAtomically
 * acontece lá por usuário. Assinante não-admin paga normalmente; a isenção
 * de admin é por flag de usuário, nunca herdada da rota.
 *
 * Montado em app.ts atrás da flag FEATURE_COPILOT === 'true' (default OFF).
 */
import { validateSubscriber, SubscriberRequest } from '../middleware/adminAuth.js';
import { getChatTools } from '../services/chat/toolRegistry.js';
import { createChatSessionRouter } from '../services/chat/chatSessionHandlers.js';

const router = createChatSessionRouter({
  guard: validateSubscriber,
  resolveTools: (req) =>
    getChatTools({
      isAdmin: (req as SubscriberRequest).isAdmin === true,
      // validateSubscriber só deixa passar assinante ativo ou admin
      isSubscriber: true,
    }),
  promptVariant: 'copilot',
  logPrefix: '[Copilot]',
});

export default router;
