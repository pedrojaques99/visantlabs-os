import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@example.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const WHATSAPP_GROUP_URL = process.env.WHATSAPP_GROUP_URL || '';

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
    await emailService.emails.send({
      from: RESEND_FROM_EMAIL,
      to: email,
      template: 'password-reset',
      data: {
        USER_NAME: userName,
        RESET_URL: resetUrl,
      },
    } as any);
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
    await emailService.emails.send({
      from: RESEND_FROM_EMAIL,
      to: email,
      template: 'welcome',
      data: {
        USER_NAME: userName,
        DASHBOARD_URL: dashboardUrl,
      },
    } as any);
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
  const formattedAmount = amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount / 100) : null;
  
  const creditsText = `${credits} crédito${credits > 1 ? 's' : ''}`;
  const creditsPlural = credits > 1 ? 's' : '';
  const totalCreditsSection = totalCredits !== undefined 
    ? `<p style="color: #e5e5e5; margin: 10px 0 0 0; font-size: 14px;">Total de Créditos Disponíveis: ${totalCredits}</p>` 
    : '';
  const amountSection = formattedAmount 
    ? `<p style="color: #e5e5e5; margin: 10px 0 0 0; font-size: 14px;">Valor Pago: ${formattedAmount}</p>` 
    : '';

  try {
    await emailService.emails.send({
      from: RESEND_FROM_EMAIL,
      to: email,
      template: 'credits-purchased',
      data: {
        USER_NAME: userName,
        CREDITS: credits,
        CREDITS_TEXT: creditsText,
        CREDITS_PLURAL: creditsPlural,
        TOTAL_CREDITS_SECTION: totalCreditsSection,
        AMOUNT_SECTION: amountSection,
        DASHBOARD_URL: dashboardUrl,
      },
    } as any);
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
    await emailService.emails.send({
      from: RESEND_FROM_EMAIL,
      to: email,
      template: 'newsletter-welcome',
      data: {
        WHATSAPP_URL: WHATSAPP_GROUP_URL || undefined,
      },
    } as any);
  } catch (error: any) {
    console.error('Error sending newsletter welcome email:', error);
    throw new Error(`Failed to send newsletter welcome email: ${error.message || 'Unknown error'}`);
  }
};
