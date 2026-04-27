import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@example.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const WHATSAPP_GROUP_URL = process.env.WHATSAPP_GROUP_URL || '';

// Template IDs from Resend dashboard — leave empty to use HTML fallback
const TEMPLATE_IDS = {
  welcome: process.env.RESEND_TEMPLATE_WELCOME || '',
  passwordReset: process.env.RESEND_TEMPLATE_PASSWORD_RESET || '',
  creditsPurchased: process.env.RESEND_TEMPLATE_CREDITS_PURCHASED || '',
  newsletterWelcome: process.env.RESEND_TEMPLATE_NEWSLETTER_WELCOME || '',
};

let resend: Resend | null = null;

export const isEmailConfigured = (): boolean => {
  return !!RESEND_API_KEY && !!RESEND_FROM_EMAIL;
};

export const getEmailService = (): Resend | null => {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!resend) {
    resend = new Resend(RESEND_API_KEY);
  }

  return resend;
};

// ---------------------------------------------------------------------------
// HTML fallbacks
// ---------------------------------------------------------------------------

const baseHtml = (content: string) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;margin:0;padding:32px}
.card{background:#1a1a1a;border-radius:8px;padding:32px;max-width:520px;margin:0 auto}
h2{color:#fff;margin-top:0}a.btn{display:inline-block;margin-top:20px;padding:12px 24px;
background:#7c3aed;color:#fff;border-radius:6px;text-decoration:none}
p{color:#a3a3a3;line-height:1.6}</style></head>
<body><div class="card">${content}</div></body></html>`;

const passwordResetHtml = (userName: string, resetUrl: string) =>
  baseHtml(`<h2>Redefinição de senha</h2>
<p>Olá, <strong>${userName}</strong>.</p>
<p>Clique no botão abaixo para redefinir sua senha. O link expira em 1 hora.</p>
<a class="btn" href="${resetUrl}">Redefinir senha</a>
<p style="margin-top:20px;font-size:13px">Se você não solicitou isso, ignore este e-mail.</p>`);

const welcomeHtml = (userName: string, dashboardUrl: string) =>
  baseHtml(`<h2>Bem-vindo à Visant Labs!</h2>
<p>Olá, <strong>${userName}</strong>!</p>
<p>Sua conta foi criada com sucesso. Acesse o painel para começar.</p>
<a class="btn" href="${dashboardUrl}">Acessar painel</a>`);

const creditsPurchasedHtml = (
  userName: string,
  creditsText: string,
  totalCredits: number | undefined,
  formattedAmount: string | null,
  dashboardUrl: string,
) =>
  baseHtml(`<h2>Créditos adicionados</h2>
<p>Olá, <strong>${userName}</strong>!</p>
<p>Você adquiriu <strong>${creditsText}</strong> com sucesso.</p>
${formattedAmount ? `<p>Valor pago: <strong>${formattedAmount}</strong></p>` : ''}
${totalCredits !== undefined ? `<p>Total disponível: <strong>${totalCredits} créditos</strong></p>` : ''}
<a class="btn" href="${dashboardUrl}">Acessar painel</a>`);

const newsletterWelcomeHtml = (whatsappUrl: string) =>
  baseHtml(`<h2>Obrigado por se inscrever!</h2>
<p>Você está na lista de espera da Visant Labs. Entraremos em contato em breve.</p>
${whatsappUrl ? `<a class="btn" href="${whatsappUrl}">Entrar no grupo do WhatsApp</a>` : ''}`);

// ---------------------------------------------------------------------------
// Helpers to build send payload (template if configured, HTML otherwise)
// ---------------------------------------------------------------------------

type SendPayload = Parameters<Resend['emails']['send']>[0];

const withTemplate = (
  base: { from: string; to: string; subject: string },
  templateId: string,
  variables: Record<string, unknown>,
  htmlFallback: string,
): SendPayload => {
  if (templateId) {
    return { ...base, template: { id: templateId, variables } } as unknown as SendPayload;
  }
  return { ...base, html: htmlFallback };
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export interface SendPasswordResetEmailParams {
  email: string;
  name?: string;
  resetToken: string;
}

export const sendPasswordResetEmail = async (params: SendPasswordResetEmailParams): Promise<void> => {
  const { email, name, resetToken } = params;

  const emailService = getEmailService();
  if (!emailService) {
    throw new Error('Email service is not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.');
  }

  const resetUrl = `${FRONTEND_URL}/forgot-password?token=${resetToken}`;
  const userName = name || email.split('@')[0];

  try {
    await emailService.emails.send(
      withTemplate(
        { from: RESEND_FROM_EMAIL, to: email, subject: 'Redefinição de senha — Visant Labs' },
        TEMPLATE_IDS.passwordReset,
        { USER_NAME: userName, RESET_URL: resetUrl },
        passwordResetHtml(userName, resetUrl),
      ),
    );
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    throw new Error(`Failed to send password reset email: ${error.message || 'Unknown error'}`);
  }
};

export interface SendWelcomeEmailParams {
  email: string;
  name?: string;
}

export const sendWelcomeEmail = async (params: SendWelcomeEmailParams): Promise<void> => {
  const { email, name } = params;

  const emailService = getEmailService();
  if (!emailService) {
    throw new Error('Email service is not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.');
  }

  const dashboardUrl = `${FRONTEND_URL}`;
  const userName = name || email.split('@')[0];

  try {
    await emailService.emails.send(
      withTemplate(
        { from: RESEND_FROM_EMAIL, to: email, subject: 'Bem-vindo à Visant Labs!' },
        TEMPLATE_IDS.welcome,
        { USER_NAME: userName, DASHBOARD_URL: dashboardUrl },
        welcomeHtml(userName, dashboardUrl),
      ),
    );
  } catch (error: any) {
    console.error('Error sending welcome email:', error);
    throw new Error(`Failed to send welcome email: ${error.message || 'Unknown error'}`);
  }
};

export interface SendCreditsPurchasedEmailParams {
  email: string;
  name?: string;
  credits: number;
  totalCredits?: number;
  amount?: number;
  currency?: string;
}

export const sendCreditsPurchasedEmail = async (params: SendCreditsPurchasedEmailParams): Promise<void> => {
  const { email, name, credits, totalCredits, amount, currency = 'BRL' } = params;

  const emailService = getEmailService();
  if (!emailService) {
    throw new Error('Email service is not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.');
  }

  const dashboardUrl = `${FRONTEND_URL}`;
  const userName = name || email.split('@')[0];
  const formattedAmount = amount
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount / 100)
    : null;
  const creditsText = `${credits} crédito${credits > 1 ? 's' : ''}`;

  try {
    await emailService.emails.send(
      withTemplate(
        { from: RESEND_FROM_EMAIL, to: email, subject: 'Créditos adicionados — Visant Labs' },
        TEMPLATE_IDS.creditsPurchased,
        {
          USER_NAME: userName,
          CREDITS: credits,
          CREDITS_TEXT: creditsText,
          TOTAL_CREDITS: totalCredits ?? null,
          AMOUNT: formattedAmount ?? null,
          DASHBOARD_URL: dashboardUrl,
        },
        creditsPurchasedHtml(userName, creditsText, totalCredits, formattedAmount, dashboardUrl),
      ),
    );
  } catch (error: any) {
    console.error('Error sending credits purchased email:', error);
    throw new Error(`Failed to send credits purchased email: ${error.message || 'Unknown error'}`);
  }
};

export interface SendNewsletterWelcomeEmailParams {
  email: string;
}

export const sendNewsletterWelcomeEmail = async (params: SendNewsletterWelcomeEmailParams): Promise<void> => {
  const { email } = params;

  const emailService = getEmailService();
  if (!emailService) {
    throw new Error('Email service is not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.');
  }

  try {
    await emailService.emails.send(
      withTemplate(
        { from: RESEND_FROM_EMAIL, to: email, subject: 'Você está na lista — Visant Labs' },
        TEMPLATE_IDS.newsletterWelcome,
        { WHATSAPP_URL: WHATSAPP_GROUP_URL || null },
        newsletterWelcomeHtml(WHATSAPP_GROUP_URL),
      ),
    );
  } catch (error: any) {
    console.error('Error sending newsletter welcome email:', error);
    throw new Error(`Failed to send newsletter welcome email: ${error.message || 'Unknown error'}`);
  }
};
