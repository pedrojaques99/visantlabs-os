import { createHash } from 'crypto';
import { readFileSync, existsSync, statSync } from 'fs';
import { basename, extname } from 'path';

import chalk from 'chalk';

import { apiFetch } from '../lib/api.js';
import { loadCredentials } from '../lib/credentials.js';

/**
 * Por que este comando existe
 *
 * A tool MCP `upload-image` so' aceita base64 no corpo da chamada. Isso obriga
 * um agente a carregar o arquivo inteiro pro proprio contexto e re-emitir os
 * bytes na chamada -- caro em token e, acima de alguns milhares de caracteres,
 * ERRADO: o agente trunca no meio e o upload sobe uma imagem corrompida.
 *
 * O `Buffer.from(x, 'base64')` do Node ignora cauda invalida em silencio, entao
 * o servidor aceita, devolve 200 e uma URL que aponta pra um JPEG quebrado.
 * Ninguem descobre ate' a imagem ser usada.
 *
 * Aqui o arquivo vai do disco pra rede sem passar pelo modelo. O agente chama
 * `visant upload foo.png` por shell e recebe so' a URL de volta.
 */

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const MAX = 20 * 1024 * 1024;

/** Confere o tipo real pelos magic bytes, nao pela extensao. */
function sniff(buf: Buffer): string | null {
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'image/webp';
  const head = buf.subarray(0, 200).toString('utf-8').trimStart();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'image/svg+xml';
  return null;
}

export async function uploadCommand(files: string[], opts: { label?: string; json?: boolean }) {
  const creds = loadCredentials();
  if (!creds) {
    console.error(chalk.red('Não autenticado.') + chalk.dim(' Execute: visant login'));
    process.exit(1);
  }

  const results: Array<{ file: string; url?: string; id?: string; size?: number; error?: string }> =
    [];

  for (const file of files) {
    try {
      if (!existsSync(file)) throw new Error('arquivo não encontrado');
      const size = statSync(file).size;
      if (size > MAX)
        throw new Error(`${(size / 1024 / 1024).toFixed(1)}MB excede o limite de 20MB`);
      if (size === 0) throw new Error('arquivo vazio');

      const buf = readFileSync(file);
      const real = sniff(buf);
      const byExt = MIME[extname(file).toLowerCase()];
      if (!real && !byExt) throw new Error('tipo de imagem não reconhecido');
      if (real && byExt && real !== byExt) {
        console.error(
          chalk.yellow(
            `⚠ ${basename(file)}: extensão diz ${byExt}, conteúdo é ${real} — usando o conteúdo.`
          )
        );
      }
      const contentType = real ?? byExt;

      const sha256 = createHash('sha256').update(buf).digest('hex');

      const out = await apiFetch('/images/upload', {
        method: 'POST',
        token: creds.apiKey,
        body: JSON.stringify({
          data: buf.toString('base64'),
          contentType,
          label: opts.label ?? basename(file, extname(file)),
          sha256,
          bytes: buf.length,
        }),
      });

      // O servidor devolve o tamanho que ele decodificou. Se divergir, os bytes
      // nao chegaram inteiros -- falhar alto e' melhor que uma URL quebrada.
      if (typeof out.size === 'number' && out.size !== buf.length) {
        throw new Error(`integridade: enviei ${buf.length}B, servidor decodificou ${out.size}B`);
      }

      results.push({ file, url: out.url, id: out.id, size: out.size });
    } catch (err: any) {
      results.push({ file, error: err?.message ?? String(err) });
    }
  }

  if (opts.json) {
    console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  } else {
    console.log();
    for (const r of results) {
      if (r.error) console.log(`  ${chalk.red('✗')} ${basename(r.file)}  ${chalk.dim(r.error)}`);
      else console.log(`  ${chalk.green('✓')} ${basename(r.file)}  ${chalk.cyan(r.url!)}`);
    }
    console.log();
  }

  if (results.some((r) => r.error)) process.exit(1);
}
