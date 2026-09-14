// /api/auth/magic-link — entrar pelo e-mail, sem senha (14/09/2026).
//
// Montado em app.ts DEPOIS de '/auth': o router de auth não tem rota
// '/magic-link', então o Express segue pra este.
//
// Quem pede hoje é só o Visant Club, que é onde mora a página que recebe o
// token (app.visant.club/entrar/link). O visantlabs.com não tem essa página,
// então o link aponta pro Club sempre. O `app` do schema existe pra, no dia em
// que o Labs tiver a própria página, a escolha ficar explícita.
import express from 'express';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { JWT_SECRET } from '../utils/jwtSecret.js';
import { CLUB_BASE_URL } from '../lib/mcp-constants.js';
import { magicLinkRequestSchema, magicLinkVerifySchema, formatZodError } from '../utils/schemas.js';
import {
  criarLinkMagico,
  consumirLinkMagico,
  MAGIC_LINK_TTL_MIN,
} from '../services/magicLinkService.js';
import { recordSession } from './sessions.js';

const router = express.Router();

// Cada pedido é um e-mail de verdade: teto por IP, igual ao do forgot-password.
const pedidoRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_MAGIC_LINK || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

// A troca não manda e-mail, mas é onde alguém tentaria adivinhar token.
const trocaRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

router.post('/', pedidoRateLimiter, async (req, res) => {
  try {
    const parsed = magicLinkRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }
    const { email } = parsed.data;

    // Só conta que já existe. Link mágico é porta de entrada, não cadastro:
    // quem não tem conta entra pelo Google, que cria.
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = await criarLinkMagico(user.id, user.email);
      const loginUrl = `${CLUB_BASE_URL}/entrar/link?token=${token}`;
      try {
        const { sendMagicLinkEmail, isEmailConfigured } =
          await import('../services/emailService.js');
        if (isEmailConfigured()) {
          await sendMagicLinkEmail({
            email: user.email,
            name: user.name || undefined,
            loginUrl,
            minutos: MAGIC_LINK_TTL_MIN,
          });
        } else if (process.env.NODE_ENV === 'development') {
          console.log('🔗 Magic link (dev only):', loginUrl);
        }
      } catch (emailError: any) {
        // Não falha o pedido: a resposta tem que ser igual pra toda conta.
        console.error('Error sending magic link email:', emailError?.message || emailError);
      }
    }

    // Mesma resposta exista a conta ou não: senão a rota vira verificador.
    return res.json({
      message: 'If an account with that email exists, a login link has been sent.',
    });
  } catch (error: any) {
    console.error('Magic link request error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to process login link request' });
  }
});

router.post('/verify', trocaRateLimiter, async (req, res) => {
  try {
    const parsed = magicLinkVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }

    // Inexistente, vencido ou já usado: a mesma resposta, de propósito.
    const dono = await consumirLinkMagico(parsed.data.token);
    if (!dono) return res.status(400).json({ error: 'Invalid or expired token' });

    const user = await prisma.user.findUnique({ where: { id: dono.userId } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    // A mesma sessão de quem entra com senha no /signin.
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    });
    recordSession(user.id, req).catch(() => {});

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        username: user.username,
        emailVerified: user.emailVerified,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error: any) {
    console.error('Magic link verify error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to verify login link' });
  }
});

export default router;
