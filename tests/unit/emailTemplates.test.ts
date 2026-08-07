import { describe, it, expect, vi, beforeEach } from 'vitest';

// A chave e o FRONTEND_URL são lidos no topo do módulo — precisam existir ANTES
// do import. A barra final é de propósito: é o formato que o .env já usa em
// VITE_FRONTEND_URL e o que gerava link com barra dupla.
process.env.RESEND_API_KEY = 'test-key';
process.env.RESEND_FROM_EMAIL = 'noreply@visantlabs.com';
process.env.FRONTEND_URL = 'https://visantlabs.com/';
// Sem template ID o serviço cai no HTML embutido, que é o que estamos testando.
process.env.RESEND_TEMPLATE_BRAND_QUOTA_DOWNGRADE = '';
process.env.RESEND_TEMPLATE_WELCOME = '';

const send = vi.fn().mockResolvedValue({ id: 'sent' });
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

const lastPayload = () => send.mock.calls.at(-1)![0] as { html: string; text: string };

describe('templates de e-mail', () => {
  beforeEach(() => send.mockClear());

  it('escapa nome do usuário e nome de marca (sem injeção de HTML)', async () => {
    const { sendBrandQuotaDowngradeEmail } = await import('../../server/services/emailService.js');

    await sendBrandQuotaDowngradeEmail({
      email: 'x@y.com',
      name: '<img src=x onerror=alert(1)>',
      atRiskBrands: ['<script>evil()</script>'],
      keepCount: 1,
      graceUntil: '2026-07-28T00:00:00.000Z',
    });

    const { html } = lastPayload();
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>evil()');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
  });

  it('monta o link sem barra dupla mesmo com FRONTEND_URL terminando em /', async () => {
    const { sendBrandQuotaDowngradeEmail } = await import('../../server/services/emailService.js');

    await sendBrandQuotaDowngradeEmail({
      email: 'x@y.com',
      name: 'Ronnie',
      atRiskBrands: ['Old 1'],
      keepCount: 1,
      graceUntil: '2026-07-28T00:00:00.000Z',
    });

    const { html, text } = lastPayload();
    expect(html).toContain('href="https://visantlabs.com/brand-guidelines"');
    expect(html).not.toContain('com//brand-guidelines');
    expect(text).toContain('https://visantlabs.com/brand-guidelines');
  });

  it('não manda aviso nem lembrete com a fila vazia, e não pede retry', async () => {
    const { sendBrandQuotaDowngradeEmail, sendBrandQuotaReminderEmail } =
      await import('../../server/services/emailService.js');
    const params = {
      email: 'x@y.com',
      name: 'Ronnie',
      atRiskBrands: [],
      keepCount: 1,
      graceUntil: '2026-07-28T00:00:00.000Z',
    };

    // `true` = "nada a fazer". `false` faria o cron reenviar para sempre.
    expect(await sendBrandQuotaDowngradeEmail(params)).toBe(true);
    expect(await sendBrandQuotaReminderEmail(params)).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it('envia versão texto junto do HTML', async () => {
    const { sendWelcomeEmail } = await import('../../server/services/emailService.js');

    await sendWelcomeEmail({ email: 'x@y.com', name: 'Ronnie' });

    const { html, text } = lastPayload();
    expect(text).toBeTruthy();
    expect(text).not.toContain('<');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('não usa travessão nem bolinha separadora na copy (regra visant-copy)', async () => {
    const { sendBrandQuotaDowngradeEmail } = await import('../../server/services/emailService.js');

    await sendBrandQuotaDowngradeEmail({
      email: 'x@y.com',
      name: 'Ronnie',
      atRiskBrands: ['Old 1'],
      keepCount: 1,
      graceUntil: '2026-07-28T00:00:00.000Z',
    });

    const { html, text } = lastPayload();
    for (const body of [html, text]) {
      expect(body).not.toMatch(/[—–·≠]/);
    }
  });
});
