#!/usr/bin/env node

/**
 * Script para testar conexão e upload real no Cloudflare R2
 * Este script tenta fazer um upload de teste para validar as credenciais
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const envFiles = ['.env.local', '.env'];

function loadEnv() {
  for (const file of envFiles) {
    const envPath = join(rootDir, file);
    if (!existsSync(envPath)) continue;

    const content = readFileSync(envPath, 'utf-8');
    const env = {};

    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) return;

      const key = trimmed.substring(0, equalIndex).trim();
      let value = trimmed.substring(equalIndex + 1).trim();

      // Remove aspas se existirem
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key && value) {
        env[key] = value;
      }
    });

    return { file, env };
  }
  return null;
}

console.log('🧪 Testando conexão com Cloudflare R2...\n');

const result = loadEnv();
if (!result) {
  console.error('❌ Nenhum arquivo .env encontrado.');
  process.exit(1);
}

// Carregar variáveis de ambiente
const accountId = result.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = result.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = result.env.R2_SECRET_ACCESS_KEY?.trim();
const bucketName = result.env.R2_BUCKET_NAME?.trim();
const publicUrl = result.env.R2_PUBLIC_URL?.trim();

// Validar que todas as variáveis estão presentes
if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
  console.error('❌ Variáveis R2 incompletas. Execute primeiro: npm run check-r2-env');
  process.exit(1);
}

// Validar formato do Account ID
if (!/^[a-f0-9]{32}$/i.test(accountId)) {
  console.error('⚠️  AVISO: Account ID pode estar em formato incorreto.');
  console.error('   Esperado: 32 caracteres hexadecimais');
  console.error('   Recebido:', accountId.length, 'caracteres');
  console.error('   Valor:', accountId);
  console.error('');
}

console.log('📋 Configuração encontrada:');
console.log(
  `   Account ID: ${accountId.substring(0, 8)}...${accountId.substring(accountId.length - 4)} (${
    accountId.length
  } chars)`
);
console.log(`   Access Key ID: ${accessKeyId.substring(0, 8)}... (${accessKeyId.length} chars)`);
console.log(`   Secret Access Key: ${'*'.repeat(8)}... (${secretAccessKey.length} chars)`);
console.log(`   Bucket: ${bucketName}`);
console.log(`   Public URL: ${publicUrl}`);
console.log(`   Endpoint: https://${accountId}.r2.cloudflarestorage.com`);
console.log(`   Path-style: true (forcePathStyle)\n`);

// Criar cliente S3 com forcePathStyle para compatibilidade com R2
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true, // Importante para R2
});

async function testConnection() {
  try {
    console.log('🔍 Teste 1: Verificando acesso ao bucket...');
    // Tentar ListObjectsV2 primeiro (mais simples e informativo)
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1, // Apenas verificar se conseguimos acessar
      })
    );
    console.log('   ✅ Bucket acessível!');
    console.log(`   📊 Objetos no bucket: ${result.KeyCount || 0}\n`);
  } catch (error) {
    console.error('   ❌ Erro ao acessar bucket:', error.message);
    console.error('   Tipo de erro:', error.name);
    console.error('   Código:', error.Code || error.code || 'N/A');

    if (error.$metadata) {
      console.error('   Status HTTP:', error.$metadata.httpStatusCode || 'N/A');
      console.error('   Request ID:', error.$metadata.requestId || 'N/A');
      if (error.$metadata.httpStatusCode === 403) {
        console.error('\n   🔒 ERRO 403 (FORBIDDEN) DETECTADO!');
        console.error('   Isso geralmente significa:');
        console.error('   1. Credenciais incorretas (Access Key ID ou Secret Access Key)');
        console.error('   2. Token não tem permissões suficientes');
        console.error('   3. Token não tem acesso ao bucket especificado');
        console.error('   4. Access Key ID e Secret Access Key não correspondem ao mesmo token');
      }
    }

    // Sempre mostrar stack em caso de UnknownError para debug
    if (error.name === 'UnknownError' || error.message?.includes('UnknownError')) {
      console.error('   Stack completo:', error.stack || 'N/A');
      console.error(
        '   Erro completo:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      );
    } else if (error.stack && process.env.DEBUG) {
      console.error('   Stack:', error.stack);
    }

    if (error.name === 'SignatureDoesNotMatch') {
      console.error('\n   💡 ERRO DE ASSINATURA DETECTADO!');
      console.error('   As credenciais estão incorretas. Verifique:');
      console.error('   1. Access Key ID e Secret Access Key são do mesmo token?');
      console.error('   2. Você está usando Account API Token (não User API Token)?');
      console.error('   3. Não há espaços extras nas variáveis?');
      console.error('   4. As credenciais foram copiadas corretamente?');
    } else if (error.name === 'NotFound' || error.Code === 'NoSuchBucket') {
      console.error(`   💡 Bucket "${bucketName}" não encontrado. Verifique o nome.`);
    } else if (
      error.name === 'UnknownError' ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('ECONNREFUSED')
    ) {
      console.error('\n   💡 ERRO DE CONEXÃO DETECTADO!');
      console.error('   Problemas possíveis:');
      console.error('   1. Endpoint incorreto:', `https://${accountId}.r2.cloudflarestorage.com`);
      console.error('   2. Account ID pode estar incorreto (atual:', accountId, ')');
      console.error('   3. Problemas de rede/DNS');
      console.error('   4. Verifique se o Account ID está correto no Cloudflare Dashboard');
      console.error('   5. O Account ID deve ser hexadecimal de 32 caracteres');

      // Tentar mostrar mais detalhes do erro
      if (error.cause) {
        console.error('   Causa:', error.cause);
      }
      if (error.$response) {
        console.error('   Response status:', error.$response.statusCode);
      }
    }
    throw error;
  }
}

async function testUpload() {
  try {
    console.log('🔍 Teste 2: Fazendo upload de teste...');

    // Criar uma pequena imagem PNG de teste (1x1 pixel transparente)
    const testImageBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const testBuffer = Buffer.from(testImageBase64, 'base64');
    const testKey = `test-${Date.now()}.png`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: testBuffer,
        ContentType: 'image/png',
      })
    );

    console.log('   ✅ Upload realizado com sucesso!');
    console.log(`   📁 Arquivo: ${testKey}`);
    console.log(`   🔗 URL pública: ${publicUrl}/${testKey}\n`);

    return testKey;
  } catch (error) {
    console.error('   ❌ Erro ao fazer upload:', error.message);
    console.error('   Tipo de erro:', error.name);
    console.error('   Código:', error.Code || error.code || 'N/A');

    if (error.$metadata) {
      console.error('   Status HTTP:', error.$metadata.httpStatusCode || 'N/A');
    }

    if (error.name === 'SignatureDoesNotMatch') {
      console.error('\n   💡 ERRO DE ASSINATURA DETECTADO!');
      console.error('   As credenciais estão incorretas. Verifique:');
      console.error('   1. Access Key ID e Secret Access Key são do mesmo token?');
      console.error('   2. Você está usando Account API Token (não User API Token)?');
      console.error('   3. Não há espaços extras nas variáveis?');
      console.error('   4. As credenciais foram copiadas corretamente?');
      console.error('   5. O Account ID está correto?');
    } else if (error.Code === 'AccessDenied' || error.name === 'AccessDenied') {
      console.error('   💡 Acesso negado. Verifique as permissões do token.');
    } else if (error.name === 'UnknownError' || error.message?.includes('ENOTFOUND')) {
      console.error('\n   💡 ERRO DE CONEXÃO!');
      console.error('   Verifique o endpoint e Account ID.');
    }
    throw error;
  }
}

async function runTests() {
  try {
    await testConnection();
    const testKey = await testUpload();

    console.log('='.repeat(50));
    console.log('✅ TODOS OS TESTES PASSARAM!');
    console.log('='.repeat(50));
    console.log('\n🎉 Suas credenciais R2 estão funcionando corretamente!');
    console.log(`\n💡 Você pode excluir o arquivo de teste: ${testKey}`);
    console.log('   (Ele será sobrescrito naturalmente ou pode ser removido manualmente)');
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ TESTES FALHARAM');
    console.error('='.repeat(50));
    console.error('\n🔧 Próximos passos:');
    console.error('1. Verifique suas credenciais no Cloudflare Dashboard');
    console.error('2. Certifique-se de usar Account API Token');
    console.error('3. Recrie o token se necessário');
    console.error('4. Atualize as variáveis de ambiente no Vercel');
    console.error('5. Execute este teste novamente após atualizar');
    process.exit(1);
  }
}

runTests();
