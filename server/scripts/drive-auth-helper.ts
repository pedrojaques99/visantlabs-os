/**
 * Gera o GOOGLE_DRIVE_REFRESH_TOKEN reaproveitando o GOOGLE_CLIENT_ID/SECRET
 * que já existe (login Google do app). Rode UMA vez na sua máquina:
 *
 *   1. No Google Cloud Console > Credentials > seu OAuth 2.0 Client,
 *      adicione `http://localhost:53682` em "Authorized redirect URIs"
 *   2. GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... bun server/scripts/drive-auth-helper.ts
 *      (ou rode com o .env carregado)
 *   3. Faça login com a conta dona dos PSDs no browser que abrir
 *   4. Copie o GOOGLE_DRIVE_REFRESH_TOKEN impresso pro Coolify
 *
 * O token dá acesso somente-leitura (drive.readonly) ao Drive da conta logada
 * e não expira enquanto o app OAuth estiver publicado (produção).
 */
import { createServer } from 'http';

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no ambiente.');
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline', // garante refresh_token
    prompt: 'consent',      // força emitir refresh_token mesmo se já consentiu antes
  }).toString();

console.log('\nAbra no browser e faça login com a conta dona dos PSDs:\n');
console.log(authUrl + '\n');
console.log(`Aguardando callback em ${REDIRECT_URI} ...\n`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', REDIRECT_URI);
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');

  if (err) {
    const safeErr = String(err).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    res.end(`Erro: ${safeErr}. Pode fechar esta aba.`);
    console.error(`✗ OAuth error: ${err}`);
    process.exit(1);
  }
  if (!code) {
    res.end('Sem code na URL.');
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = (await tokenRes.json()) as { refresh_token?: string; error_description?: string };

    if (!tokens.refresh_token) {
      throw new Error(tokens.error_description || 'Resposta sem refresh_token');
    }

    res.end('Pronto! Pode fechar esta aba e voltar pro terminal.');
    console.log('✓ Sucesso! Adicione no Coolify (e .env local se quiser):\n');
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    server.close();
    process.exit(0);
  } catch (e: any) {
    res.end(`Falha ao trocar o code: ${e.message}`);
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
});

server.listen(PORT);
