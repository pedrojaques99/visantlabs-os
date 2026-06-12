/**
 * Migra os assets de Scene Packages de WebP → PNG no Spaces + atualiza o Mongo.
 *
 * Motivo: o fallback server decodifica os assets com node-canvas (sem WebP), e
 * converter com sharp no processo do servidor dispara o clash libvips×Cairo no
 * Debian. Scenes passam a ser PNG na origem (ver encodeAsset no sceneStore).
 *
 * Roda LOCAL com env carregado (Spaces + Mongo):
 *   npx tsx server/scripts/migrate-scene-assets-png.ts
 *
 * Idempotente: pula scenes cujos files já são .png.
 */
import { connectToMongoDB } from '../db/mongodb.js';
import { uploadPrivateAsset, downloadAsset } from '../services/spacesService.js';

async function main() {
  const sharp = (await import('sharp')).default;
  const db = await connectToMongoDB();
  const col = db.collection('psd_scenes');
  const docs = await col.find({}).toArray();
  console.log(`[migrate] ${docs.length} scene(s) no catálogo.`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of docs) {
    const files: Array<{ ref: string; key: string; bytes: number }> = doc.files || [];
    const webpFiles = files.filter((f) => f.key.endsWith('.webp'));
    if (!webpFiles.length) {
      skipped++;
      continue;
    }
    try {
      const newFiles = [...files];
      for (const f of webpFiles) {
        const webp = await downloadAsset(f.key);
        const png = await sharp(webp).png().toBuffer();
        const newKey = f.key.replace(/\.webp$/, '.png');
        await uploadPrivateAsset(png, newKey, 'image/png');
        const idx = newFiles.findIndex((x) => x.ref === f.ref);
        newFiles[idx] = { ref: f.ref, key: newKey, bytes: png.length };
      }
      await col.updateOne(
        { _id: doc._id },
        { $set: { files: newFiles, updatedAt: new Date() } }
      );
      migrated++;
      console.log(`[migrate] ✔ ${doc.psdFileName} (${webpFiles.length} asset(s))`);
    } catch (err: any) {
      failed++;
      console.log(`[migrate] ✗ ${doc.psdFileName}: ${err.message}`);
    }
  }

  console.log(`\n[migrate] concluído: ${migrated} migradas, ${skipped} já PNG, ${failed} falhas`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('[migrate] fatal:', e.message);
  process.exit(1);
});
