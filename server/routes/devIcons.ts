/**
 * Dev-only Icon Swap — reescreve uma linha do barrel `src/lib/ui/icons.ts` pra
 * apontar um slot (nome lucide) pra outro glifo do Phosphor. Alimenta o picker
 * da rota /design-system/icons. NUNCA montar/rodar em produção (guard abaixo).
 *
 * POST /api/dev-icons/icon-swap  { lucideName, phosphorName }
 */
import express, { type Request, type Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';

const router = express.Router();

const BARREL = path.resolve(process.cwd(), 'src/lib/ui/icons.ts');
const PHOSPHOR_CSR = path.resolve(
  process.cwd(),
  'node_modules/@phosphor-icons/react/dist/csr',
);
const IDENT = /^[A-Z][A-Za-z0-9]*$/; // aceita nomes de 1 char (ex: "X")

const isDev = () => process.env.NODE_ENV !== 'production';

router.post('/icon-swap', async (req: Request, res: Response) => {
  if (!isDev()) return res.status(403).json({ error: 'dev only' });

  const lucideName = String(req.body?.lucideName ?? '');
  const phosphorName = String(req.body?.phosphorName ?? '');
  if (!IDENT.test(lucideName) || !IDENT.test(phosphorName)) {
    return res.status(400).json({ error: 'invalid icon names' });
  }

  // O nome Phosphor precisa existir de verdade (1 arquivo por ícone no CSR),
  // senão gravaríamos um import quebrado que só estoura no tsc/HMR.
  try {
    await fs.access(path.join(PHOSPHOR_CSR, `${phosphorName}.es.js`));
  } catch {
    return res.status(404).json({ error: `Phosphor icon "${phosphorName}" não existe` });
  }

  let src: string;
  try {
    src = await fs.readFile(BARREL, 'utf8');
  } catch {
    return res.status(500).json({ error: 'não achei o barrel' });
  }

  const lines = src.split('\n');
  const asRe = new RegExp(`^export \\{\\s*[A-Za-z0-9]+\\s+as\\s+${lucideName}\\s*\\}`);
  const exactRe = new RegExp(`^export \\{\\s*${lucideName}\\s*\\}`);
  const idx = lines.findIndex((l) => asRe.test(l) || exactRe.test(l));
  if (idx === -1) {
    return res.status(404).json({ error: `slot "${lucideName}" não encontrado no barrel` });
  }

  lines[idx] =
    phosphorName === lucideName
      ? `export { ${lucideName} } from '@phosphor-icons/react';`
      : `export { ${phosphorName} as ${lucideName} } from '@phosphor-icons/react';`;

  try {
    await fs.writeFile(BARREL, lines.join('\n'));
  } catch {
    return res.status(500).json({ error: 'falha ao gravar o barrel' });
  }

  return res.json({ ok: true, lucideName, phosphorName, line: lines[idx] });
});

export default router;
