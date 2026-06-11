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
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

  const cdn = process.env.DO_SPACES_CDN_URL?.trim()?.replace(/\/$/, '');
  if (cdn) return `${cdn}/${key}`;

  // https://<bucket>.<region>.digitaloceanspaces.com/<key>
  const endpointHost = (process.env.DO_SPACES_ENDPOINT || '').replace(/^https?:\/\//, '');
  return `https://${bucket}.${endpointHost}/${key}`;
}
