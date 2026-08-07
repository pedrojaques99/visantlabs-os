import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';

// Enforcement is behind the flag — set BEFORE the lib is imported.
process.env.FEATURE_BRAND_BILLING = 'true';

// Os três avisos da jornada viram spies. `downgrade` devolve true por padrão;
// os testes de retry sobrescrevem.
const downgrade = vi.fn().mockResolvedValue(true);
const reminder = vi.fn().mockResolvedValue(true);
const archived = vi.fn().mockResolvedValue(true);
vi.mock('../../../server/services/emailService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../server/services/emailService.js')>();
  return {
    ...actual,
    sendBrandQuotaDowngradeEmail: downgrade,
    sendBrandQuotaReminderEmail: reminder,
    sendBrandQuotaArchivedEmail: archived,
  };
});

const lib = () => import('../../../server/lib/brandQuota.js');
const db = () => import('../../../server/db/prisma.js');

const HOUR = 3_600_000;

/** Free tier = 1 marca ativa. Cria `count` marcas e devolve o usuário. */
async function userOverQuota(count: number, names?: string[]) {
  const { user } = await createUser();
  for (let i = 0; i < count; i++) {
    await createBrandGuideline({ userId: user.id, name: names?.[i] ?? `Marca ${i + 1}` });
  }
  return user;
}

/** Reescreve a janela de grace pra simular a passagem do tempo. */
async function setGrace(userId: string, msFromNow: number, extra: Record<string, any> = {}) {
  const { prisma } = await db();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { metadata: true } });
  await prisma.user.update({
    where: { id: userId },
    data: {
      metadata: {
        ...((u?.metadata as Record<string, any> | null) || {}),
        brandQuotaGraceUntil: new Date(Date.now() + msFromNow).toISOString(),
        ...extra,
      },
    },
  });
}

async function metaOf(userId: string) {
  const { prisma } = await db();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { metadata: true } });
  return (u?.metadata as Record<string, any> | null) || {};
}

describe('Brand billing — jornada de downgrade ponta a ponta', () => {
  beforeEach(() => {
    downgrade.mockClear().mockResolvedValue(true);
    reminder.mockClear().mockResolvedValue(true);
    archived.mockClear().mockResolvedValue(true);
  });

  it('a quota expõe as marcas em risco, na mesma ordem que o cron vai arquivar', async () => {
    const user = await userOverQuota(3, ['Antiga', 'Meio', 'Recente']);
    const { prisma } = await db();
    const { enforceBrandQuotaOnDowngrade, getBrandQuotaForUserId } = await lib();

    // "Recente" vira a mais atualizada → é a sobrevivente.
    const all = await prisma.brandGuideline.findMany({ where: { userId: user.id } });
    const recente = all.find((b) => (b.identity as any)?.name === 'Recente');
    await prisma.brandGuideline.update({
      where: { id: recente!.id },
      data: { folder: 'touch' },
    });

    await enforceBrandQuotaOnDowngrade(user.id);
    const quota = await getBrandQuotaForUserId(user.id);

    expect(quota.graceUntil).toBeTruthy();
    expect(quota.atRisk?.map((b) => b.name)).toEqual(['Antiga', 'Meio']);
    // O e-mail recebeu exatamente a mesma lista — tela e aviso não divergem.
    expect(downgrade.mock.calls[0][0].atRiskBrands).toEqual(['Antiga', 'Meio']);
  });

  it('quem não tem marca não entra na jornada', async () => {
    const { user } = await createUser();
    const { enforceBrandQuotaOnDowngrade } = await lib();

    const result = await enforceBrandQuotaOnDowngrade(user.id);

    expect(result.excess).toBe(0);
    expect(result.graceUntil).toBeNull();
    expect(downgrade).not.toHaveBeenCalled();
    expect((await metaOf(user.id)).brandQuotaGraceUntil).toBeUndefined();
  });

  it('quem está exatamente no limite também não entra', async () => {
    const user = await userOverQuota(1); // free = 1 marca ativa
    const { enforceBrandQuotaOnDowngrade } = await lib();

    const result = await enforceBrandQuotaOnDowngrade(user.id);

    expect(result.excess).toBe(0);
    expect(downgrade).not.toHaveBeenCalled();
  });

  it('não expõe atRisk fora de uma janela de grace', async () => {
    const { user } = await createUser();
    await createBrandGuideline({ userId: user.id, name: 'Única' });
    const { getBrandQuotaForUserId } = await lib();

    const quota = await getBrandQuotaForUserId(user.id);
    expect(quota.graceUntil).toBeFalsy();
    expect(quota.atRisk).toBeUndefined();
  });

  it('marca o aviso como pendente quando o envio falha e reenvia no cron', async () => {
    downgrade.mockResolvedValue(false); // Resend fora do ar
    const user = await userOverQuota(2);
    const { enforceBrandQuotaOnDowngrade, sendBrandQuotaReminders } = await lib();

    await enforceBrandQuotaOnDowngrade(user.id);
    expect((await metaOf(user.id)).brandQuotaNoticePending).toBe(true);

    downgrade.mockResolvedValue(true); // voltou
    const result = await sendBrandQuotaReminders();

    expect(result.noticesRetried).toBe(1);
    expect(downgrade).toHaveBeenCalledTimes(2);
    expect((await metaOf(user.id)).brandQuotaNoticePending).toBeUndefined();
  });

  it('manda o lembrete uma vez quando faltam 48h ou menos', async () => {
    const user = await userOverQuota(2);
    const { enforceBrandQuotaOnDowngrade, sendBrandQuotaReminders } = await lib();
    await enforceBrandQuotaOnDowngrade(user.id);

    await setGrace(user.id, 24 * HOUR);
    expect((await sendBrandQuotaReminders()).remindersSent).toBe(1);

    // Segunda passada do cron no mesmo dia não pode reenviar.
    expect((await sendBrandQuotaReminders()).remindersSent).toBe(0);
    expect(reminder).toHaveBeenCalledTimes(1);
  });

  it('não manda lembrete enquanto sobra mais de 48h', async () => {
    const user = await userOverQuota(2);
    const { enforceBrandQuotaOnDowngrade, sendBrandQuotaReminders } = await lib();
    await enforceBrandQuotaOnDowngrade(user.id);

    await setGrace(user.id, 5 * 24 * HOUR);
    expect((await sendBrandQuotaReminders()).remindersSent).toBe(0);
    expect(reminder).not.toHaveBeenCalled();
  });

  it('limpa a janela quando o usuário resolve sozinho durante o grace', async () => {
    const user = await userOverQuota(2);
    const { prisma } = await db();
    const { enforceBrandQuotaOnDowngrade, sendBrandQuotaReminders } = await lib();
    await enforceBrandQuotaOnDowngrade(user.id);
    await setGrace(user.id, 24 * HOUR);

    // Arquiva a sobrando à mão → volta pro limite.
    const first = await prisma.brandGuideline.findFirst({ where: { userId: user.id } });
    await prisma.brandGuideline.update({
      where: { id: first!.id },
      data: { status: 'archived' },
    });

    await sendBrandQuotaReminders();

    const meta = await metaOf(user.id);
    expect(meta.brandQuotaGraceUntil).toBeUndefined();
    expect(meta.brandQuotaExcess).toBeUndefined();
    expect(meta.brandQuotaReminderSentFor).toBeUndefined();
    expect(reminder).not.toHaveBeenCalled();
  });

  it('arquiva no fim do prazo, avisa o que foi arquivado e registra os ids', async () => {
    const user = await userOverQuota(3, ['A', 'B', 'C']);
    const { enforceBrandQuotaOnDowngrade, archiveExcessBrands } = await lib();
    await enforceBrandQuotaOnDowngrade(user.id);
    await setGrace(user.id, -HOUR); // prazo venceu

    const result = await archiveExcessBrands();

    expect(result.brandsArchived).toBe(2);
    expect(result.usersRemaining).toBe(0);
    expect(archived).toHaveBeenCalledTimes(1);
    expect(archived.mock.calls[0][0].archivedBrands).toEqual(['A', 'B']);

    const meta = await metaOf(user.id);
    expect(meta.brandQuotaArchived.ids).toHaveLength(2);
    // A janela some inteira, sem sobrar chave órfã pro próximo downgrade.
    expect(meta.brandQuotaGraceUntil).toBeUndefined();
    expect(meta.brandQuotaReminderSentFor).toBeUndefined();
    expect(meta.brandQuotaNoticePending).toBeUndefined();
  });

  it('não avisa arquivamento quando o usuário já resolveu antes do prazo', async () => {
    const user = await userOverQuota(2);
    const { prisma } = await db();
    const { enforceBrandQuotaOnDowngrade, archiveExcessBrands } = await lib();
    await enforceBrandQuotaOnDowngrade(user.id);
    await setGrace(user.id, -HOUR);

    const first = await prisma.brandGuideline.findFirst({ where: { userId: user.id } });
    await prisma.brandGuideline.update({
      where: { id: first!.id },
      data: { status: 'archived' },
    });

    const result = await archiveExcessBrands();

    expect(result.brandsArchived).toBe(0);
    expect(archived).not.toHaveBeenCalled();
    expect((await metaOf(user.id)).brandQuotaGraceUntil).toBeUndefined();
  });
});
