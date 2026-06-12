/**
 * Batch de Scene Packages: anda a árvore do Drive (pasta pública BOXY),
 * coleta todos os .psd e roda o psd-scene-extract --upload um a um, cada
 * PSD num processo filho isolado (memória zerada por arquivo).
 *
 * Uso (com env carregado — Drive + Spaces + Mongo):
 *   npx tsx server/scripts/psd-scene-batch.ts [--root <folderId>] [--skip-existing] [--limit N]
 *
 * --skip-existing pula PSDs que já têm registro em psd_scenes (Mongo).
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT =
  process.argv.includes('--root')
    ? process.argv[process.argv.indexOf('--root') + 1]
    : (process.env.GOOGLE_DRIVE_PUBLIC_FOLDER_IDS || '').split(',')[0]?.trim();
const SKIP_EXISTING = process.argv.includes('--skip-existing');
const LIMIT = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10)
  : Infinity;

const EXTRACT_SCRIPT = path.join(__dirname, 'psd-scene-extract.ts');

async function getDrive(): Promise<any> {
  const { google } = await import('googleapis');
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: oauth2 });
}

/** Walk BFS da árvore; retorna nomes (bare) de todos os .psd. */
async function listPsdsRecursive(drive: any, rootId: string): Promise<string[]> {
  const names: string[] = [];
  const queue = [rootId];
  while (queue.length) {
    const folderId = queue.shift()!;
    let pageToken: string | undefined;
    do {
      const resp = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size)',
        pageSize: 1000,
        pageToken,
      });
      for (const f of resp.data.files || []) {
        if (f.mimeType === 'application/vnd.google-apps.folder') queue.push(f.id);
        else if (f.name?.toLowerCase().endsWith('.psd')) names.push(f.name);
      }
      pageToken = resp.data.nextPageToken || undefined;
    } while (pageToken);
  }
  return names;
}

async function existingSceneNames(): Promise<Set<string>> {
  const { connectToMongoDB } = await import('../db/mongodb.js');
  const db = await connectToMongoDB();
  const docs = await db
    .collection('psd_scenes')
    .find({}, { projection: { psdFileName: 1 } })
    .toArray();
  return new Set(docs.map((d: any) => d.psdFileName));
}

function runExtract(psdName: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    // shell:true no Windows não preserva args com espaço — quote manual.
    const proc = spawn(
      'npx',
      ['tsx', `"${EXTRACT_SCRIPT}"`, '--psd', `"${psdName}"`, '--upload'],
      {
        env: process.env,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let out = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => proc.kill(), 10 * 60 * 1000); // 10min por PSD
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && out.includes('registro gravado no Mongo'), output: out });
    });
  });
}

async function main() {
  if (!ROOT) {
    console.error('Defina --root ou GOOGLE_DRIVE_PUBLIC_FOLDER_IDS');
    process.exit(1);
  }
  console.log(`[batch] listando PSDs sob ${ROOT}...`);
  const drive = await getDrive();
  let names = await listPsdsRecursive(drive, ROOT);
  // dedup por nome (resolução do engine é por bare name — nomes duplicados na
  // árvore renderizariam sempre o primeiro match; processa 1x só)
  names = [...new Set(names)];
  console.log(`[batch] ${names.length} PSD(s) na árvore.`);

  if (SKIP_EXISTING) {
    const have = await existingSceneNames();
    names = names.filter((n) => !have.has(n));
    console.log(`[batch] ${names.length} sem scene ainda (--skip-existing).`);
  }
  names = names.slice(0, LIMIT);

  const results: Array<{ name: string; ok: boolean; note: string }> = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    process.stdout.write(`[batch] (${i + 1}/${names.length}) ${name} ... `);
    const { ok, output } = await runExtract(name);
    const warn = output.match(/⚠ .+/g)?.join('; ') || '';
    const err = ok ? '' : (output.match(/erro: .+/)?.[0] || 'falhou');
    console.log(ok ? `OK ${warn ? `(${warn})` : ''}` : `FALHOU — ${err}`);
    results.push({ name, ok, note: ok ? warn : err });
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n[batch] concluído: ${okCount}/${results.length} OK`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log('[batch] falhas:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.note}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[batch] erro fatal:', err.message);
  process.exit(1);
});
