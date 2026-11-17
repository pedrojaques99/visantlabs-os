// Assinatura do Visant Club vendida pela Hubla → estado de assinante no Labs.
//
// O Club decide acesso por `subscriptionTier ∈ CLUB_TIERS` **e**
// `subscriptionStatus === 'active'` (ver server/routes/adminClub.ts). Este
// arquivo grava esse mesmo par, mais os créditos do mês, para quem assina pela
// Hubla. Origem marcada em `clubSource: 'hubla'` + `hublaSubscriptionId`, que é
// a chave usada pra desativar depois — nunca por e-mail.
//
// Créditos (60/mês, lib/catalogo.mjs PLANO.creditosMes no visant-club):
// - cada fatura paga da assinatura zera `creditsUsed` UMA vez. A chave é o id da
//   fatura em `processed_payment_events` (provider 'hubla'), então a 1ª fatura,
//   que chega duas vezes (member_added.lastInvoice e invoice.payment_succeeded),
//   concede uma vez só, e reenvio da Hubla não concede de novo.
// - `subscriptionEndDate` fica VAZIO de propósito: o reset preguiçoso de
//   middleware/subscription.ts usa ele como próxima data e, sem fatura que o
//   empurre pra frente (o Stripe empurra no customer.subscription.updated), o
//   reset viraria a cada requisição. Vazio = próximo reset em +30 dias, o que
//   também cobre o plano anual (uma fatura por ano, crédito todo mês).
//
// O que NÃO é sobrescrito (não quebrar quem já paga por outro caminho):
// - assinatura ativa do Stripe (`stripeSubscriptionId` + status active), seja do
//   Club ou do SaaS;
// - tier pago do Labs ativo (starter/pro/...), mesmo sem Stripe;
// - membro do Club ativo que não veio da Hubla (fundador, role manual).
// Nesses casos não grava nada e devolve `skipped` pro log: é caso pra pessoa
// olhar (provável reembolso), não pra máquina decidir.
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { claimPaymentEvent, releasePaymentEvent } from '../lib/paymentIdempotency.js';
import { FREE_MONTHLY_CREDITS } from '../lib/credits.js';

export const CLUB_MONTHLY_CREDITS = 60;
const CLUB_TIERS = new Set(['club', 'fundador', 'visantista']);
const DAY = 24 * 60 * 60 * 1000;

export type ClubSkipReason = 'stripe-subscription' | 'labs-tier' | 'club-other-source';

export interface ClubDeps {
  db: Db;
  /** Acha por e-mail ou cria conta sem senha (findOrCreateSubscriber). */
  findOrCreateUser: (input: {
    email: string;
    name?: string;
  }) => Promise<{ id: string; created: boolean }>;
  now?: () => Date;
}

const creditsKey = (invoiceId: string) => `club-credits:${invoiceId}`;

/** Próxima data de reset: um mês de calendário à frente. */
function nextReset(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

function userFilter(id: string) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as any };
}

export interface ActivateClubResult {
  userId: string;
  created: boolean;
  /** true = não era assinante ativo por esta assinatura e passou a ser agora. */
  activated: boolean;
  creditsGranted: boolean;
  skipped?: ClubSkipReason;
}

export async function activateHublaClub(
  deps: ClubDeps,
  input: {
    email: string;
    name?: string;
    subscriptionId: string;
    /** Fatura que pagou esta ativação (subscription.lastInvoice.id). */
    invoiceId?: string;
  }
): Promise<ActivateClubResult> {
  const now = deps.now?.() ?? new Date();
  const users = deps.db.collection('users');
  const found = await deps.findOrCreateUser({ email: input.email, name: input.name });
  const user: any = await users.findOne(userFilter(found.id));
  if (!user) throw new Error(`activateHublaClub: conta ${found.id} sumiu depois de criada`);

  const tier = String(user.subscriptionTier || 'free').toLowerCase();
  const active = String(user.subscriptionStatus || '').toLowerCase() === 'active';
  const fromHubla = user.clubSource === 'hubla';
  const base = { userId: found.id, created: found.created };

  if (active && user.stripeSubscriptionId) {
    return { ...base, activated: false, creditsGranted: false, skipped: 'stripe-subscription' };
  }
  if (active && !CLUB_TIERS.has(tier) && tier !== 'free') {
    return { ...base, activated: false, creditsGranted: false, skipped: 'labs-tier' };
  }
  if (active && CLUB_TIERS.has(tier) && !fromHubla) {
    return { ...base, activated: false, creditsGranted: false, skipped: 'club-other-source' };
  }

  const wasActive =
    active && tier === 'club' && fromHubla && user.hublaSubscriptionId === input.subscriptionId;

  // Sem id de fatura (payload antigo), a 1ª ativação desta assinatura vale como
  // a fatura: concede uma vez e a renovação segue pelas faturas.
  const key = creditsKey(input.invoiceId || `activation:${input.subscriptionId}`);
  const claimed = await claimPaymentEvent(deps.db, 'hubla', key);

  const set: Record<string, unknown> = {
    subscriptionTier: 'club',
    subscriptionStatus: 'active',
    clubSource: 'hubla',
    hublaSubscriptionId: input.subscriptionId,
    monthlyCredits: CLUB_MONTHLY_CREDITS,
  };
  if (claimed) {
    set.creditsUsed = 0;
    set.creditsResetDate = nextReset(now);
  }
  try {
    await users.updateOne(userFilter(found.id), {
      $set: set,
      $unset: { subscriptionEndDate: '' },
    });
  } catch (error) {
    if (claimed) await releasePaymentEvent(deps.db, 'hubla', key);
    throw error;
  }
  return { ...base, activated: !wasActive, creditsGranted: claimed };
}

export interface DeactivateClubResult {
  deactivated: boolean;
  userId?: string;
}

/** Fim da assinatura (reembolso, chargeback ou fim do período cancelado). */
export async function deactivateHublaClub(
  deps: Pick<ClubDeps, 'db' | 'now'>,
  input: { subscriptionId: string }
): Promise<DeactivateClubResult> {
  const now = deps.now?.() ?? new Date();
  const users = deps.db.collection('users');
  const user: any = await users.findOne({
    hublaSubscriptionId: input.subscriptionId,
    clubSource: 'hubla',
  });
  if (!user) return { deactivated: false };

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        subscriptionTier: 'free',
        subscriptionStatus: 'canceled',
        monthlyCredits: FREE_MONTHLY_CREDITS,
        creditsUsed: 0,
        creditsResetDate: new Date(now.getTime() + 30 * DAY),
      },
      $unset: { hublaSubscriptionId: '', clubSource: '' },
    }
  );
  return { deactivated: true, userId: String(user._id) };
}

export interface RenewClubResult {
  renewed: boolean;
  /** Esta fatura já tinha concedido os créditos (reenvio ou 1ª fatura). */
  already?: boolean;
  /** Ninguém ativo com esta assinatura ainda: o member_added concede. */
  noMember?: boolean;
  userId?: string;
}

/** Fatura paga da assinatura → créditos do mês de novo, uma vez por fatura. */
export async function renewHublaClubCredits(
  deps: Pick<ClubDeps, 'db' | 'now'>,
  input: { subscriptionId: string; invoiceId: string }
): Promise<RenewClubResult> {
  const now = deps.now?.() ?? new Date();
  const users = deps.db.collection('users');
  const user: any = await users.findOne({
    hublaSubscriptionId: input.subscriptionId,
    clubSource: 'hubla',
    subscriptionStatus: 'active',
  });
  // Não carimba: se a fatura chegou antes do member_added, é ele que concede
  // (lastInvoice.id é esta mesma fatura).
  if (!user) return { renewed: false, noMember: true };

  const key = creditsKey(input.invoiceId);
  if (!(await claimPaymentEvent(deps.db, 'hubla', key))) {
    return { renewed: false, already: true, userId: String(user._id) };
  }
  try {
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          monthlyCredits: CLUB_MONTHLY_CREDITS,
          creditsUsed: 0,
          creditsResetDate: nextReset(now),
        },
      }
    );
  } catch (error) {
    await releasePaymentEvent(deps.db, 'hubla', key);
    throw error;
  }
  return { renewed: true, userId: String(user._id) };
}
