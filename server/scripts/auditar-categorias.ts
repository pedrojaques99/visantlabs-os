/**
 * Auditoria SOMENTE LEITURA de `users.userCategory`.
 *
 * Até o fix do allowlist, POST /api/auth/complete-onboarding gravava qualquer
 * string em `userCategory`, então qualquer conta podia se dar 'tester' (premium
 * do Labs) ou 'team' (o Visant Club lia como acesso a todo curso pago). Este
 * script conta usuários por categoria e lista os IDs (nunca e-mail) de quem tem
 * categoria privilegiada, pra o dono revisar quem se autopromoveu.
 *
 * Não escreve nada. Rodar contra uma cópia/branch do banco, não contra prod:
 *   npx tsx server/scripts/auditar-categorias.ts
 *
 * Sinal útil: o código antigo copiava o valor cru pra `metadata.onboardingPersona`.
 * Então `persona=team`/`persona=tester` (igual à categoria) quase certamente veio
 * de um body forjado: o wizard só manda designer/agency/marketing/developer.
 */
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';
import { ONBOARDING_PERSONAS, PRIVILEGED_USER_CATEGORIES } from '../lib/onboardingPersona.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'mockup-machine';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(MONGODB_URI!, { readPreference: 'secondaryPreferred' });
  try {
    await client.connect();
    const users = client.db(DB_NAME).collection('users');

    const porCategoria = await users
      .aggregate<{ _id: string | null; total: number }>([
        { $group: { _id: '$userCategory', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ])
      .toArray();

    const personas = new Set<string>(ONBOARDING_PERSONAS);
    console.log('\nUsuários por userCategory:');
    for (const row of porCategoria) {
      const cat = row._id ?? '(vazio)';
      const tag = PRIVILEGED_USER_CATEGORIES.has(String(row._id))
        ? '  ← PRIVILEGIADA'
        : row._id && !personas.has(String(row._id))
          ? '  ← fora do allowlist'
          : '';
      console.log(`  ${String(cat).padEnd(20)} ${String(row.total).padStart(6)}${tag}`);
    }

    const privilegiados = await users
      .find(
        { userCategory: { $in: [...PRIVILEGED_USER_CATEGORIES] } },
        {
          projection: {
            _id: 1,
            userCategory: 1,
            isAdmin: 1,
            createdAt: 1,
            'metadata.onboardingPersona': 1,
          },
        }
      )
      .sort({ createdAt: 1 })
      .toArray();

    console.log(`\nCategoria privilegiada: ${privilegiados.length} usuário(s)`);
    for (const u of privilegiados) {
      const criado = u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '?';
      const persona = (u.metadata as any)?.onboardingPersona ?? '-';
      console.log(
        `  ${String(u._id)}  categoria=${u.userCategory}  admin=${u.isAdmin === true}  persona=${persona}  criado=${criado}`
      );
    }
    console.log('\nNada foi alterado. Corrigir à mão (rota de admin) quem não deveria estar aí.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Erro:', error?.message || error);
  process.exit(1);
});
