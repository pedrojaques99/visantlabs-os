/**
 * Seed / sync script para as collections Mongo usadas pelo `tagService`:
 *
 *   branding_presets   ← AVAILABLE_BRANDING_TAGS
 *   mockup_presets     ← AVAILABLE_TAGS            (product categories)
 *   ambience_presets   ← AVAILABLE_LOCATION_TAGS
 *   angle_presets      ← AVAILABLE_ANGLE_TAGS
 *   luminance_presets  ← AVAILABLE_LIGHTING_TAGS
 *   effect_presets     ← AVAILABLE_EFFECT_TAGS
 *   texture_presets    ← AVAILABLE_MATERIAL_TAGS
 *
 * Usa `src/utils/mockupConstants.ts` como single source of truth — rode depois
 * de editar aquelas constants pra propagar pro DB.
 *
 * Uso:
 *   npx tsx server/scripts/seedMockupPresets.ts            # upsert (default)
 *   npx tsx server/scripts/seedMockupPresets.ts --prune    # upsert + remove extras
 *   npx tsx server/scripts/seedMockupPresets.ts --dry      # só imprime o plano
 *
 * Flags:
 *   --prune  remove do DB tags que não existem mais nas constants
 *   --dry    não escreve nada, só loga o que faria
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import {
    AVAILABLE_TAGS,
    AVAILABLE_BRANDING_TAGS,
    AVAILABLE_LOCATION_TAGS,
    AVAILABLE_ANGLE_TAGS,
    AVAILABLE_LIGHTING_TAGS,
    AVAILABLE_EFFECT_TAGS,
    AVAILABLE_MATERIAL_TAGS,
} from '../../src/utils/mockupConstants.js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const POOLS: Array<{ collection: string; label: string; tags: readonly string[] }> = [
    { collection: 'branding_presets',  label: 'branding',  tags: AVAILABLE_BRANDING_TAGS },
    { collection: 'mockup_presets',    label: 'categories', tags: AVAILABLE_TAGS },
    { collection: 'ambience_presets',  label: 'locations', tags: AVAILABLE_LOCATION_TAGS },
    { collection: 'angle_presets',     label: 'angles',    tags: AVAILABLE_ANGLE_TAGS },
    { collection: 'luminance_presets', label: 'lighting',  tags: AVAILABLE_LIGHTING_TAGS },
    { collection: 'effect_presets',    label: 'effects',   tags: AVAILABLE_EFFECT_TAGS },
    { collection: 'texture_presets',   label: 'materials', tags: AVAILABLE_MATERIAL_TAGS },
];

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const PRUNE = args.includes('--prune');

async function main() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    const dbName = process.env.MONGODB_DB || process.env.MONGO_DB;
    if (!uri) throw new Error('MONGODB_URI não definido no .env / .env.local');

    console.log(`\n🌱 Seeding mockup presets → ${dbName || '(default db)'}`);
    console.log(`   mode: ${DRY ? 'DRY-RUN' : 'WRITE'}${PRUNE ? ' + PRUNE' : ''}\n`);

    const client = new MongoClient(uri);
    await client.connect();
    const db = dbName ? client.db(dbName) : client.db();

    let totalInserted = 0;
    let totalPruned = 0;
    let totalKept = 0;

    for (const pool of POOLS) {
        const col = db.collection(pool.collection);
        const existingDocs = await col.find({}, { projection: { name: 1 } }).toArray();
        const existing = new Set(existingDocs.map(d => d.name as string));
        const desired = new Set(pool.tags);

        const toInsert = pool.tags.filter(t => !existing.has(t));
        const toPrune = PRUNE ? [...existing].filter(t => !desired.has(t)) : [];
        const kept = pool.tags.filter(t => existing.has(t)).length;

        console.log(
            `📦 ${pool.label.padEnd(11)} (${pool.collection})  ` +
            `+${toInsert.length} new   =${kept} kept   ` +
            `${PRUNE ? `-${toPrune.length} prune` : ''}`,
        );

        if (toInsert.length > 0) {
            toInsert.forEach(t => console.log(`     + ${t}`));
            if (!DRY) {
                await col.insertMany(
                    toInsert.map(name => ({ name, createdAt: new Date(), seeded: true })),
                );
            }
        }
        if (PRUNE && toPrune.length > 0) {
            toPrune.forEach(t => console.log(`     - ${t}`));
            if (!DRY) {
                await col.deleteMany({ name: { $in: toPrune } });
            }
        }

        totalInserted += toInsert.length;
        totalPruned += toPrune.length;
        totalKept += kept;
    }

    console.log(
        `\n✅ Done. inserted=${totalInserted}  kept=${totalKept}` +
        (PRUNE ? `  pruned=${totalPruned}` : '') +
        (DRY ? '  (dry-run, nothing written)' : ''),
    );

    await client.close();
}

main().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
