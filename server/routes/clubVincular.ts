// Autoatendimento do Club: levar a compra da Hubla do e-mail A pra conta B.
// A lógica mora em services/vincularCompra.ts; aqui só fica HTTP.
//
//   POST /pedir      { email }   logado como B; manda o link pro e-mail A
//   POST /confirmar  { token }   sem login; o token do e-mail A é a prova
//
// Montado em /api/club/vincular (app.ts).
import express, { Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { CLUB_BASE_URL } from '../lib/mcp-constants.js';
import {
  pedirVinculo,
  confirmarVinculo,
  VinculoError,
  VALIDADE_HORAS,
} from '../services/vincularCompra.js';

const router = express.Router();

const limitePedido = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).userId || req.ip || 'anon',
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Muitos pedidos. Tenta de novo em alguns minutos.', code: 'limite' },
});

const limiteConfirmar = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tenta de novo em alguns minutos.', code: 'limite' },
});

function responderErro(res: Response, e: unknown, onde: string) {
  if (e instanceof VinculoError)
    return res.status(e.status).json({ error: e.message, code: e.code });
  console.error(`club/vincular/${onde} falhou:`, e);
  return res.status(500).json({ error: 'Algo falhou do nosso lado. Tenta de novo.' });
}

router.post('/pedir', authenticate, limitePedido, async (req: AuthRequest, res: Response) => {
  try {
    const { isEmailConfigured, sendPurchaseLinkConfirmEmail } =
      await import('../services/emailService.js');
    // Antes de olhar o banco: 503 depois da busca contaria quem tem compra.
    if (!isEmailConfigured())
      return res.status(503).json({ error: 'E-mail da Labs não configurado', code: 'sem-email' });
    await connectToMongoDB();
    await pedirVinculo(getDb(), req.userId!, req.body?.email, {
      enviarEmail: ({ email, name, paraEmail, token }) =>
        sendPurchaseLinkConfirmEmail({
          email,
          name,
          paraEmail,
          confirmUrl: `${CLUB_BASE_URL}/vincular?token=${encodeURIComponent(token)}`,
          horas: VALIDADE_HORAS,
        }),
    });
    return res.json({ ok: true });
  } catch (e) {
    return responderErro(res, e, 'pedir');
  }
});

router.post('/confirmar', limiteConfirmar, async (req: AuthRequest, res: Response) => {
  try {
    await connectToMongoDB();
    const r = await confirmarVinculo(getDb(), req.body?.token);
    return res.json({ ok: true, ...r });
  } catch (e) {
    return responderErro(res, e, 'confirmar');
  }
});

export default router;
