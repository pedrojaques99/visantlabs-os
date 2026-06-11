/**
 * DigitalOcean Spaces (S3-compatible) — upload público de assets renderizados.
 * Usa as MESMAS credenciais já configuradas no Coolify para download de PSDs
 * (DO_SPACES_KEY/SECRET/ENDPOINT) + bucket/CDN. Sem custo novo: o Spaces é da BOXY.
 *
 * Env:
 *   DO_SPACES_KEY / DO_SPACES_SECRET / DO_SPACES_ENDPOINT   (já existem)
 *   DO_SPACES_BUCKET                                        bucket de destino
 *   DO_SPACES_CDN_URL                                       opcional, URL pública CDN
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const key = process.env.DO_SPACES_KEY?.trim();
  const secret = process.env.DO_SPACES_SECRET?.trim();
  const endpoint = process.env.DO_SPACES_ENDPOINT?.trim();
  if (!key || !secret || !endpoint) {
    throw new Error('DO Spaces não configurado (DO_SPACES_KEY/SECRET/ENDPOINT)');
  }
  client = new S3Client({
    region: 'us-east-1',
    endpoint,
    credentials: { accessKeyId: key, secretAccessKey: secret },
    forcePathStyle: false,
  });
  return client;
}

export function isSpacesConfigured(): boolean {
  return !!(
    process.env.DO_SPACES_KEY &&
    process.env.DO_SPACES_SECRET &&
    process.env.DO_SPACES_ENDPOINT &&
    process.env.DO_SPACES_BUCKET
  );
}

/** Sobe um buffer com ACL public-read e retorna a URL pública (CDN se houver). */
export async function uploadPublicAsset(
  buffer: Buffer,
  key: string,
  contentType = 'image/png'
): Promise<string> {
  const bucket = process.env.DO_SPACES_BUCKET?.trim();
  if (!bucket) throw new Error('DO_SPACES_BUCKET não configurado');

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000',
    })
  );

  return publicSpacesUrl(bucket, key);
}

function publicSpacesUrl(bucket: string, key: string): string {
  const cdn = process.env.DO_SPACES_CDN_URL?.trim()?.replace(/\/$/, '');
  if (cdn) return `${cdn}/${key}`;

  // https://<bucket>.<region>.digitaloceanspaces.com/<key>
  const endpointHost = (process.env.DO_SPACES_ENDPOINT || '').replace(/^https?:\/\//, '');
  return `https://${bucket}.${endpointHost}/${key}`;
}

/**
 * Sobe um buffer SEM ACL public-read (objeto privado) e retorna a key.
 * Usado por Scene Packages: as imagens flatten nunca devem ser enumeráveis nem
 * baixáveis sem assinatura — servimos por signed URL com TTL atrás do gate de
 * quota/tier. Cai pra public-read se o bucket não suportar ACL privada.
 */
export async function uploadPrivateAsset(
  buffer: Buffer,
  key: string,
  contentType = 'application/octet-stream'
): Promise<{ key: string }> {
  const bucket = process.env.DO_SPACES_BUCKET?.trim();
  if (!bucket) throw new Error('DO_SPACES_BUCKET não configurado');

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'private',
      CacheControl: 'private, max-age=31536000',
    })
  );
  return { key };
}

/**
 * Gera uma signed URL de leitura (GET) com TTL. Spaces é S3-compatible, então o
 * presigner do AWS SDK funciona. Default 10min. Se a assinatura falhar (config
 * incompleta), cai pra URL pública (mitigação: a key contém um hash não-enumerável).
 */
export async function getSignedReadUrl(key: string, expiresInSeconds = 600): Promise<string> {
  const bucket = process.env.DO_SPACES_BUCKET?.trim();
  if (!bucket) throw new Error('DO_SPACES_BUCKET não configurado');
  try {
    return await getSignedUrl(
      getClient(),
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: Math.min(Math.max(60, Math.floor(expiresInSeconds)), 86400) }
    );
  } catch (err) {
    console.warn('[spaces] signed URL falhou, usando URL pública (key com hash):', (err as Error).message);
    return publicSpacesUrl(bucket, key);
  }
}

/**
 * Baixa um objeto privado (ou público) do Spaces por key, via credenciais S3.
 * Usado pelo fast path do /render pra buscar scene.json + imagens.
 */
export async function downloadAsset(key: string): Promise<Buffer> {
  const bucket = process.env.DO_SPACES_BUCKET?.trim();
  if (!bucket) throw new Error('DO_SPACES_BUCKET não configurado');
  const resp = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
