import { Resend } from 'resend';
import { FRONTEND_BASE_URL } from '../lib/mcp-constants.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@example.com';
// Normaliza a barra final igual auth.ts:44 e abacatepayService.ts:101 — sem isso
// um FRONTEND_URL terminado em "/" gera link com barra dupla em todo e-mail.
const FRONTEND_URL = FRONTEND_BASE_URL.replace(/\/+$/, '');
const WHATSAPP_GROUP_URL = process.env.WHATSAPP_GROUP_URL || '';

// Template IDs from Resend dashboard — leave empty to use HTML fallback
const TEMPLATE_IDS = {
  welcome: process.env.RESEND_TEMPLATE_WELCOME || '',
  passwordReset: process.env.RESEND_TEMPLATE_PASSWORD_RESET || '',
  creditsPurchased: process.env.RESEND_TEMPLATE_CREDITS_PURCHASED || '',
  newsletterWelcome: process.env.RESEND_TEMPLATE_NEWSLETTER_WELCOME || '',
  emailVerification: process.env.RESEND_TEMPLATE_EMAIL_VERIFICATION || '',
  brandQuotaDowngrade: process.env.RESEND_TEMPLATE_BRAND_QUOTA_DOWNGRADE || '',
  brandQuotaReminder: process.env.RESEND_TEMPLATE_BRAND_QUOTA_REMINDER || '',
  brandQuotaArchived: process.env.RESEND_TEMPLATE_BRAND_QUOTA_ARCHIVED || '',
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
//
// Estes templates viajam para clientes de e-mail, não para um browser. Duas
// consequências que ditam a forma abaixo:
//   1. Outlook desktop roda no motor do Word: ignora <style> no <head>, não
//      pinta background no <body> e não entende border-radius. Layout é tabela
//      com estilo inline; a cor de fundo mora numa <td bgcolor>.
//   2. Todo dado do usuário é HOSTIL. `name` é campo livre no cadastro, então
//      passa por escapeHtml() na fronteira, sem exceção.
// Cada template devolve { html, text }: a versão texto some do olho do usuário
// mas conta no score de spam, e é o que aparece em cliente que bloqueia HTML.
// ---------------------------------------------------------------------------

/** Escapa qualquer valor vindo do usuário antes de injetar no HTML do e-mail. */
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Paleta do e-mail. `accent` espelha --brand-cyan (src/utils/colorUtils.ts:465). */
const MAIL = {
  page: '#0a0a0a',
  card: '#161616',
  border: '#262626',
  heading: '#fafafa',
  body: '#a3a3a3',
  muted: '#737373',
  accent: '#00d9ff',
  onAccent: '#0a1416',
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  /** Mesma marca do Header.tsx:187. Servida pelo frontend na Vercel. */
  logo: `${FRONTEND_URL}/logo-vsn-labs.png`,
} as const;

const P = `margin:0 0 14px;color:${MAIL.body};font-size:15px;line-height:1.6`;
const SMALL = `margin:20px 0 0;color:#737373;font-size:13px;line-height:1.5`;
const STRONG = `color:${MAIL.heading};font-weight:600`;

/** Botão em tabela: <a> puro perde o preenchimento de fundo no Outlook. */
const button = (href: string, label: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0">
<tr><td bgcolor="${MAIL.accent}" style="border-radius:6px">
<a href="${href}" style="display:inline-block;padding:12px 24px;font-family:${MAIL.font};font-size:15px;font-weight:600;color:${MAIL.onAccent};text-decoration:none">${label}</a>
</td></tr></table>`;

/**
 * Assinatura de marca do topo. O wordmark é TEXTO de propósito: a maioria dos
 * clientes bloqueia imagem remota por padrão, e um cabeçalho que depende do PNG
 * chega vazio. O logo entra ao lado como reforço, com alt, e o e-mail continua
 * assinado se ele não carregar.
 */
const brandHeader = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">
<tr>
<td style="padding-right:9px" valign="middle"><img src="${MAIL.logo}" width="22" height="22" alt="" style="display:block;width:22px;height:22px;border:0"></td>
<td valign="middle" style="font-family:${MAIL.font};font-size:15px;font-weight:600;color:${MAIL.heading};letter-spacing:0.2px">Visant<span style="color:${MAIL.accent}"> Labs</span></td>
</tr>
</table>`;

/**
 * @param preheader Prévia da caixa de entrada. Sem isso o cliente mostra o
 * começo do corpo, que costuma ser "Oi, Fulano.".
 */
const baseHtml = (heading: string, content: string, preheader: string) => `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${MAIL.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${MAIL.page}" style="background:${MAIL.page}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="width:100%;max-width:520px">
<tr><td bgcolor="${MAIL.accent}" height="3" style="background:${MAIL.accent};height:3px;line-height:3px;font-size:0;border-radius:10px 10px 0 0">&nbsp;</td></tr>
<tr><td bgcolor="${MAIL.card}" style="background:${MAIL.card};border:1px solid ${MAIL.border};border-top:0;border-radius:0 0 10px 10px;padding:28px 32px 32px;font-family:${MAIL.font}">
${brandHeader}
<h1 style="margin:0 0 18px;color:${MAIL.heading};font-size:21px;line-height:1.3;font-weight:600">${escapeHtml(heading)}</h1>
${content}
</td></tr>
<tr><td align="center" style="padding:20px 8px 0;font-family:${MAIL.font};color:#525252;font-size:12px;line-height:1.6">Visant Labs, plataforma de marca<br>Dúvida? Responde este e-mail que a gente lê.</td></tr>
</table>
</td></tr></table>
</body></html>`;

interface MailBody {
  html: string;
  text: string;
}

const passwordResetMail = (userName: string, resetUrl: string): MailBody => ({
  html: baseHtml(
    'Vamos criar uma senha nova',
    `<p style="${P}">Oi, <strong style="${STRONG}">${escapeHtml(userName)}</strong>.</p>
<p style="${P}">Clica no botão aqui embaixo pra escolher uma senha nova. O link vale por 1 hora.</p>
${button(resetUrl, 'Criar senha nova')}
<p style="${SMALL}">Se não foi você que pediu, pode ignorar. Sua senha atual continua valendo.</p>`,
    'Seu link pra criar uma senha nova vale por 1 hora.'
  ),
  text: `Oi, ${userName}.

Use o link abaixo pra escolher uma senha nova. Ele vale por 1 hora.
${resetUrl}

Se não foi você que pediu, pode ignorar. Sua senha atual continua valendo.

Visant Labs`,
});

const welcomeMail = (userName: string, dashboardUrl: string): MailBody => ({
  html: baseHtml(
    'Sua conta está pronta',
    `<p style="${P}">Oi, <strong style="${STRONG}">${escapeHtml(userName)}</strong>. Que bom te ver por aqui.</p>
<p style="${P}">O próximo passo é cadastrar sua marca. É dela que a Visant tira paleta, tipografia e tom pra gerar mockup, criativo e campanha já no jeito certo.</p>
${button(dashboardUrl, 'Cadastrar minha marca')}
<p style="${SMALL}">Leva uns 2 minutos. Dá pra subir um PDF de guidelines ou começar do zero.</p>`,
    'Cadastre sua marca e a Visant já gera tudo no seu padrão.'
  ),
  text: `Oi, ${userName}. Que bom te ver por aqui.

O próximo passo é cadastrar sua marca. É dela que a Visant tira paleta, tipografia e tom pra gerar mockup, criativo e campanha já no jeito certo.

Cadastrar minha marca: ${dashboardUrl}

Leva uns 2 minutos. Dá pra subir um PDF de guidelines ou começar do zero.

Visant Labs`,
});

const creditsPurchasedMail = (
  userName: string,
  creditsText: string,
  totalCredits: number | undefined,
  formattedAmount: string | null,
  dashboardUrl: string
): MailBody => ({
  html: baseHtml(
    'Seus créditos já estão na conta',
    `<p style="${P}">Oi, <strong style="${STRONG}">${escapeHtml(userName)}</strong>.</p>
<p style="${P}">Entraram <strong style="${STRONG}">${escapeHtml(creditsText)}</strong> na sua conta. Pode gerar.</p>
${formattedAmount ? `<p style="${P}">Valor pago: <strong style="${STRONG}">${escapeHtml(formattedAmount)}</strong></p>` : ''}
${totalCredits !== undefined ? `<p style="${P}">Saldo total: <strong style="${STRONG}">${totalCredits} créditos</strong></p>` : ''}
${button(dashboardUrl, 'Abrir o painel')}`,
    `${creditsText} na sua conta. Pode gerar.`
  ),
  text: `Oi, ${userName}.

Entraram ${creditsText} na sua conta. Pode gerar.${formattedAmount ? `\nValor pago: ${formattedAmount}` : ''}${
    totalCredits !== undefined ? `\nSaldo total: ${totalCredits} créditos` : ''
  }

Abrir o painel: ${dashboardUrl}

Visant Labs`,
});

const emailVerificationMail = (userName: string, verifyUrl: string): MailBody => ({
  html: baseHtml(
    'Confirma seu e-mail',
    `<p style="${P}">Oi, <strong style="${STRONG}">${escapeHtml(userName)}</strong>.</p>
<p style="${P}">Falta um clique pra liberar sua conta. O link vale por 24 horas.</p>
${button(verifyUrl, 'Confirmar meu e-mail')}
<p style="${SMALL}">Se você não criou esta conta, pode ignorar.</p>`,
    'Falta um clique pra liberar sua conta.'
  ),
  text: `Oi, ${userName}.

Falta um clique pra liberar sua conta. O link abaixo vale por 24 horas.
${verifyUrl}

Se você não criou esta conta, pode ignorar.

Visant Labs`,
});

const newsletterWelcomeMail = (whatsappUrl: string): MailBody => ({
  html: baseHtml(
    'Você entrou na lista',
    `<p style="${P}">Seu lugar na lista de espera está garantido. A gente te chama assim que abrir vaga.</p>
${whatsappUrl ? `<p style="${P}">Enquanto isso, o grupo do WhatsApp é onde a gente mostra o que está saindo do forno.</p>${button(whatsappUrl, 'Entrar no grupo')}` : ''}`,
    'Seu lugar na lista de espera está garantido.'
  ),
  text: `Seu lugar na lista de espera da Visant Labs está garantido. A gente te chama assim que abrir vaga.${
    whatsappUrl
      ? `\n\nEnquanto isso, o grupo do WhatsApp é onde a gente mostra o que está saindo do forno.\n${whatsappUrl}`
      : ''
  }

Visant Labs`,
});

/** Placas de marca. `<ul>` com bolinha some no Outlook; tabela não. */
const brandList = (names: string[]) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 0">
${names
  .map(
    (b) =>
      `<tr><td style="padding:9px 12px;border-left:2px solid ${MAIL.accent};background:#1d1d1d;font-family:${MAIL.font};font-size:15px;color:${MAIL.heading}">${escapeHtml(b)}</td></tr><tr><td height="6" style="height:6px;line-height:6px;font-size:0">&nbsp;</td></tr>`
  )
  .join('\n')}
</table>`;

const brandQuotaDowngradeMail = (
  userName: string,
  atRiskBrands: string[],
  keepCount: number,
  deadlineText: string,
  manageUrl: string
): MailBody => {
  const plural = keepCount === 1 ? '' : 's';
  return {
    html: baseHtml(
      'Escolha quais marcas continuam ativas',
      `<p style="${P}">Oi, <strong style="${STRONG}">${escapeHtml(userName)}</strong>. Sem susto: está tudo no lugar.</p>
<p style="${P}">Seu plano mudou e agora comporta <strong style="${STRONG}">${keepCount} marca${plural} ativa${plural}</strong>. Você tem até <strong style="${STRONG}">${escapeHtml(deadlineText)}</strong> pra escolher quais ficam.</p>
<p style="${P}">Se você não escolher, a gente arquiva as menos usadas e elas passam a <strong style="${STRONG}">somente leitura</strong>. Hoje são estas:</p>
${brandList(atRiskBrands)}
${button(manageUrl, 'Escolher quais manter')}
<p style="${SMALL}">Seus dados ficam guardados. Arquivar só pausa a edição e a geração, e um upgrade traz qualquer uma de volta quando você quiser.</p>`,
      `Você tem até ${deadlineText} pra escolher quais marcas ficam ativas.`
    ),
    text: `Oi, ${userName}. Sem susto: está tudo no lugar.

Seu plano mudou e agora comporta ${keepCount} marca${plural} ativa${plural}. Você tem até ${deadlineText} pra escolher quais ficam.

Se você não escolher, a gente arquiva as menos usadas e elas passam a somente leitura. Hoje são estas:

${atRiskBrands.map((b) => `- ${b}`).join('\n')}

Escolher quais manter: ${manageUrl}

Seus dados ficam guardados. Arquivar só pausa a edição e a geração, e um upgrade traz qualquer uma de volta quando você quiser.

Visant Labs`,
  };
};

const brandQuotaReminderMail = (
  userName: string,
  atRiskBrands: string[],
  daysLeft: number,
  deadlineText: string,
  manageUrl: string
): MailBody => {
  const prazo = daysLeft <= 1 ? 'Amanhã' : `Em ${daysLeft} dias`;
  const prazoBaixo = daysLeft <= 1 ? 'amanhã' : `em ${daysLeft} dias`;
  return {
    html: baseHtml(
      `${prazo} a gente arquiva estas marcas`,
      `<p style="${P}">Oi, <strong style="${STRONG}">${escapeHtml(userName)}</strong>.</p>
<p style="${P}">Lembrete rápido: o prazo pra escolher quais marcas ficam ativas acaba <strong style="${STRONG}">${escapeHtml(deadlineText)}</strong>. Estas continuam na fila:</p>
${brandList(atRiskBrands)}
${button(manageUrl, 'Escolher quais manter')}
<p style="${SMALL}">Se estiver tudo certo assim, não precisa fazer nada. Elas passam a somente leitura e voltam com um upgrade.</p>`,
      `O prazo acaba ${prazoBaixo}. Dá uma olhada nas marcas em fila.`
    ),
    text: `Oi, ${userName}.

Lembrete rápido: o prazo pra escolher quais marcas ficam ativas acaba ${deadlineText}. Estas continuam na fila:

${atRiskBrands.map((b) => `- ${b}`).join('\n')}

Escolher quais manter: ${manageUrl}

Se estiver tudo certo assim, não precisa fazer nada. Elas passam a somente leitura e voltam com um upgrade.

Visant Labs`,
  };
};

const brandQuotaArchivedMail = (
  userName: string,
  archivedBrands: string[],
  keepCount: number,
  manageUrl: string
): MailBody => {
  const plural = archivedBrands.length === 1 ? '' : 's';
  return {
    html: baseHtml(
      `Arquivamos ${archivedBrands.length} marca${plural}`,
      `<p style="${P}">Oi, <strong style="${STRONG}">${escapeHtml(userName)}</strong>.</p>
<p style="${P}">O prazo acabou e seu plano comporta ${keepCount} marca${keepCount === 1 ? '' : 's'} ativa${keepCount === 1 ? '' : 's'}, então estas foram para o arquivo:</p>
${brandList(archivedBrands)}
<p style="${P}">Elas continuam inteiras e visíveis. O que pausou foi a edição e a geração em cima delas.</p>
${button(manageUrl, 'Ver minhas marcas')}
<p style="${SMALL}">Um upgrade reativa qualquer uma na hora, do jeito que estava.</p>`,
      `${archivedBrands.length} marca${plural} foram para o arquivo. Nada foi apagado.`
    ),
    text: `Oi, ${userName}.

O prazo acabou e seu plano comporta ${keepCount} marca${keepCount === 1 ? '' : 's'} ativa${keepCount === 1 ? '' : 's'}, então estas foram para o arquivo:

${archivedBrands.map((b) => `- ${b}`).join('\n')}

Elas continuam inteiras e visíveis. O que pausou foi a edição e a geração em cima delas.

Ver minhas marcas: ${manageUrl}

Um upgrade reativa qualquer uma na hora, do jeito que estava.

Visant Labs`,
  };
};

// ---------------------------------------------------------------------------
// Helpers to build send payload (template if configured, HTML otherwise)
// ---------------------------------------------------------------------------

type SendPayload = Parameters<Resend['emails']['send']>[0];

const withTemplate = (
  base: { from: string; to: string; subject: string },
  templateId: string,
  variables: Record<string, unknown>,
  fallback: MailBody
): SendPayload => {
  if (templateId) {
    return { ...base, template: { id: templateId, variables } } as unknown as SendPayload;
  }
  return { ...base, html: fallback.html, text: fallback.text };
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export interface SendPasswordResetEmailParams {
  email: string;
  name?: string;
  resetToken: string;
}

export const sendPasswordResetEmail = async (
  params: SendPasswordResetEmailParams
): Promise<void> => {
  const { email, name, resetToken } = params;

  const emailService = getEmailService();
  if (!emailService) {
    throw new Error(
      'Email service is not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.'
    );
  }

  const resetUrl = `${FRONTEND_URL}/forgot-password?token=${resetToken}`;
  const userName = name || email.split('@')[0];

  try {
    await emailService.emails.send(
      withTemplate(
        { from: RESEND_FROM_EMAIL, to: email, subject: 'Criar uma senha nova na Visant Labs' },
        TEMPLATE_IDS.passwordReset,
        { USER_NAME: userName, RESET_URL: resetUrl },
        passwordResetMail(userName, resetUrl)
      )
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
    throw new Error(
      'Email service is not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.'
    );
  }

  const dashboardUrl = `${FRONTEND_URL}/brand-guidelines`;
  const userName = name || email.split('@')[0];

  try {
    await emailService.emails.send(
      withTemplate(
        { from: RESEND_FROM_EMAIL, to: email, subject: 'Bem-vindo à Visant Labs' },
        TEMPLATE_IDS.welcome,
        { USER_NAME: userName, DASHBOARD_URL: dashboardUrl },
        welcomeMail(userName, dashboardUrl)
      )
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

export const sendCreditsPurchasedEmail = async (
  params: SendCreditsPurchasedEmailParams
): Promise<void> => {
  const { email, name, credits, totalCredits, amount, currency = 'BRL' } = params;

  const emailService = getEmailService();
  if (!emailService) {
    throw new Error(
      'Email service is not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.'
    );
  }

  const dashboardUrl = `${FRONTEND_URL}/brand-guidelines`;
  const userName = name || email.split('@')[0];
  const formattedAmount = amount
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount / 100)
    : null;
  const creditsText = `${credits} crédito${credits > 1 ? 's' : ''}`;

  try {
    await emailService.emails.send(
      withTemplate(
        { from: RESEND_FROM_EMAIL, to: email, subject: 'Seus créditos já estão na conta' },
        TEMPLATE_IDS.creditsPurchased,
        {
          USER_NAME: userName,
          CREDITS: credits,
          CREDITS_TEXT: creditsText,
          TOTAL_CREDITS: totalCredits ?? null,
          AMOUNT: formattedAmount ?? null,
          DASHBOARD_URL: dashboardUrl,
        },
        creditsPurchasedMail(userName, creditsText, totalCredits, formattedAmount, dashboardUrl)
      )
    );
  } catch (error: any) {
    console.error('Error sending credits purchased email:', error);
    throw new Error(`Failed to send credits purchased email: ${error.message || 'Unknown error'}`);
  }
};

export interface SendNewsletterWelcomeEmailParams {
  email: string;
}

export interface SendVerificationEmailParams {
  email: string;
  name?: string;
  verificationToken: string;
}

export const sendVerificationEmail = async (params: SendVerificationEmailParams): Promise<void> => {
  const { email, name, verificationToken } = params;

  const emailService = getEmailService();
  if (!emailService) {
    throw new Error(
      'Email service is not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.'
    );
  }

  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
  const userName = name || email.split('@')[0];

  try {
    await emailService.emails.send(
      withTemplate(
        { from: RESEND_FROM_EMAIL, to: email, subject: 'Confirma seu e-mail na Visant Labs' },
        TEMPLATE_IDS.emailVerification,
        { USER_NAME: userName, VERIFY_URL: verifyUrl },
        emailVerificationMail(userName, verifyUrl)
      )
    );
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    throw new Error(`Failed to send verification email: ${error.message || 'Unknown error'}`);
  }
};

// ── Jornada de downgrade de marca: aviso, lembrete e confirmação ──
// Os três apontam para a mesma tela e falam a mesma data. Formatador e URL
// ficam aqui em cima para não divergirem entre os passos.

const brandsUrl = () => `${FRONTEND_URL}/brand-guidelines`;

const formatDeadline = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));

export interface SendBrandQuotaDowngradeEmailParams {
  email: string;
  name?: string;
  /** Names of the brands that will be archived if the user does nothing. */
  atRiskBrands: string[];
  /** How many brands the new tier keeps active. */
  keepCount: number;
  /** ISO date the grace window ends. */
  graceUntil: string;
}

/**
 * Heads-up sent when a downgrade puts a user over their brand quota. Best-effort
 * and NON-throwing: it runs off a Stripe webhook, so a mail failure or missing
 * config must never break billing. Returns true if a send was attempted.
 */
export const sendBrandQuotaDowngradeEmail = async (
  params: SendBrandQuotaDowngradeEmailParams
): Promise<boolean> => {
  const { email, name, atRiskBrands, keepCount, graceUntil } = params;

  // Lista vazia = não há o que avisar (a marca sumiu entre a contagem e a
  // seleção). Sair com `true` de propósito: `false` significa "falhou, tenta de
  // novo", e o cron ficaria reenviando para sempre um aviso sem conteúdo.
  if (atRiskBrands.length === 0) {
    console.warn('[email] brand-quota downgrade notice skipped — no brands at risk');
    return true;
  }

  const emailService = getEmailService();
  if (!emailService) {
    console.warn('[email] brand-quota downgrade notice skipped — email service not configured');
    return false;
  }

  const manageUrl = brandsUrl();
  const userName = name || email.split('@')[0];
  const deadlineText = formatDeadline(graceUntil);

  try {
    await emailService.emails.send(
      withTemplate(
        {
          from: RESEND_FROM_EMAIL,
          to: email,
          subject: 'Escolha quais marcas continuam ativas',
        },
        TEMPLATE_IDS.brandQuotaDowngrade,
        {
          USER_NAME: userName,
          AT_RISK_BRANDS: atRiskBrands,
          KEEP_COUNT: keepCount,
          DEADLINE: deadlineText,
          MANAGE_URL: manageUrl,
        },
        brandQuotaDowngradeMail(userName, atRiskBrands, keepCount, deadlineText, manageUrl)
      )
    );
    return true;
  } catch (error: any) {
    // Never throw — the downgrade grace window is already recorded; the in-app
    // banner is the fallback notice.
    console.error('[email] brand-quota downgrade notice failed:', error?.message || error);
    return false;
  }
};

/**
 * Lembrete a 48h do prazo. Mesmos parâmetros do aviso inicial de propósito: o
 * cron reusa o payload que já montou, e as duas mensagens não podem discordar
 * sobre quais marcas estão na fila.
 */
export const sendBrandQuotaReminderEmail = async (
  params: SendBrandQuotaDowngradeEmailParams
): Promise<boolean> => {
  const { email, name, atRiskBrands, graceUntil } = params;

  // Mesma regra do aviso inicial: sem marca na fila, não há lembrete.
  if (atRiskBrands.length === 0) {
    console.warn('[email] brand-quota reminder skipped — no brands at risk');
    return true;
  }

  const emailService = getEmailService();
  if (!emailService) {
    console.warn('[email] brand-quota reminder skipped — email service not configured');
    return false;
  }

  const manageUrl = brandsUrl();
  const userName = name || email.split('@')[0];
  const deadlineText = formatDeadline(graceUntil);
  const daysLeft = Math.max(
    1,
    Math.ceil((new Date(graceUntil).getTime() - Date.now()) / 86_400_000)
  );

  try {
    await emailService.emails.send(
      withTemplate(
        {
          from: RESEND_FROM_EMAIL,
          to: email,
          subject:
            daysLeft <= 1
              ? 'Amanhã acaba o prazo das suas marcas'
              : `Faltam ${daysLeft} dias pra escolher suas marcas`,
        },
        TEMPLATE_IDS.brandQuotaReminder,
        {
          USER_NAME: userName,
          AT_RISK_BRANDS: atRiskBrands,
          DAYS_LEFT: daysLeft,
          DEADLINE: deadlineText,
          MANAGE_URL: manageUrl,
        },
        brandQuotaReminderMail(userName, atRiskBrands, daysLeft, deadlineText, manageUrl)
      )
    );
    return true;
  } catch (error: any) {
    console.error('[email] brand-quota reminder failed:', error?.message || error);
    return false;
  }
};

export interface SendBrandQuotaArchivedEmailParams {
  email: string;
  name?: string;
  /** Names of the brands that were just archived. */
  archivedBrands: string[];
  /** How many brands the plan keeps active. */
  keepCount: number;
}

/**
 * Confirmação depois do cron arquivar. Fecha a jornada: antes disso o usuário
 * perdia acesso de edição e só descobria abrindo o app.
 */
export const sendBrandQuotaArchivedEmail = async (
  params: SendBrandQuotaArchivedEmailParams
): Promise<boolean> => {
  const { email, name, archivedBrands, keepCount } = params;

  const emailService = getEmailService();
  if (!emailService) {
    console.warn('[email] brand-quota archived notice skipped — email service not configured');
    return false;
  }

  const manageUrl = brandsUrl();
  const userName = name || email.split('@')[0];
  const plural = archivedBrands.length === 1 ? '' : 's';

  try {
    await emailService.emails.send(
      withTemplate(
        {
          from: RESEND_FROM_EMAIL,
          to: email,
          subject: `Arquivamos ${archivedBrands.length} marca${plural}, nada foi apagado`,
        },
        TEMPLATE_IDS.brandQuotaArchived,
        {
          USER_NAME: userName,
          ARCHIVED_BRANDS: archivedBrands,
          KEEP_COUNT: keepCount,
          MANAGE_URL: manageUrl,
        },
        brandQuotaArchivedMail(userName, archivedBrands, keepCount, manageUrl)
      )
    );
    return true;
  } catch (error: any) {
    console.error('[email] brand-quota archived notice failed:', error?.message || error);
    return false;
  }
};

export const sendNewsletterWelcomeEmail = async (
  params: SendNewsletterWelcomeEmailParams
): Promise<void> => {
  const { email } = params;

  const emailService = getEmailService();
  if (!emailService) {
    throw new Error(
      'Email service is not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.'
    );
  }

  try {
    await emailService.emails.send(
      withTemplate(
        { from: RESEND_FROM_EMAIL, to: email, subject: 'Você entrou na lista da Visant Labs' },
        TEMPLATE_IDS.newsletterWelcome,
        { WHATSAPP_URL: WHATSAPP_GROUP_URL || null },
        newsletterWelcomeMail(WHATSAPP_GROUP_URL)
      )
    );
  } catch (error: any) {
    console.error('Error sending newsletter welcome email:', error);
    throw new Error(`Failed to send newsletter welcome email: ${error.message || 'Unknown error'}`);
  }
};
