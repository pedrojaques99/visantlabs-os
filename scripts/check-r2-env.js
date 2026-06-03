#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const envFiles = ['.env.local', '.env'];

const validators = [
  {
    name: 'R2_ACCOUNT_ID',
    description: 'ID da conta R2',
    validate: (value) => {
      const cleaned = value.trim();
      // Account ID pode ter diferentes tamanhos, mas geralmente é hex
      return /^[a-f0-9]{20,}$/i.test(cleaned) && cleaned.length >= 20;
    },
    hint: 'Deve ser um ID hexadecimal (20+ caracteres). Verifique no painel do R2.',
  },
  {
    name: 'R2_ACCESS_KEY_ID',
    description: 'Access Key ID fornecido pelo R2',
    validate: (value) => {
      const cleaned = value.trim();
      return cleaned.length >= 16;
    },
    hint: 'Deve ter pelo menos 16 caracteres. Verifique no painel do R2.',
  },
  {
    name: 'R2_SECRET_ACCESS_KEY',
    description: 'Secret Access Key fornecido pelo R2',
    validate: (value) => {
      const cleaned = value.trim();
      return cleaned.length >= 16;
    },
    hint: 'Deve ter pelo menos 16 caracteres. Se estiver muito curto, regere a chave.',
  },
  {
    name: 'R2_BUCKET_NAME',
    description: 'Nome do bucket R2',
    validate: (value) => {
      const cleaned = value.trim();
      return /^[a-z0-9-]{3,63}$/.test(cleaned);
    },
    hint: 'Somente letras minúsculas, números e hífens. Mesmo nome criado no bucket.',
  },
  {
    name: 'R2_PUBLIC_URL',
    description: 'URL pública usada nas imagens',
    validate: (value) => {
      const cleaned = value.trim();
      const hasHttps = /^https:\/\//.test(cleaned);
      const noTrailingSlash = !cleaned.endsWith('/');
      return hasHttps && noTrailingSlash;
    },
    hint: 'Use a URL pública (https://...) sem barra final. Ex: https://pub-xxxxx.r2.dev',
  },
];

function loadEnv() {
  for (const file of envFiles) {
    const envPath = join(rootDir, file);
    if (!existsSync(envPath)) continue;

    const content = readFileSync(envPath, 'utf-8');
    const env = {};

    content.split('\n').forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      // Suporta formato KEY=VALUE e KEY="VALUE"
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

console.log('🔍 Verificando variáveis de ambiente do Cloudflare R2...\n');

const result = loadEnv();
if (!result) {
  console.error('❌ Nenhum .env.local ou .env encontrado na raiz do projeto.');
  console.log('\nCrie um .env.local com as variáveis abaixo:');
  validators.forEach(({ name }) => console.log(`${name}=`));
  process.exit(1);
}

console.log(`✅ Arquivo carregado: ${result.file}\n`);

// Debug: mostrar todas as variáveis R2 encontradas
const r2Vars = Object.keys(result.env).filter((key) => key.startsWith('R2_'));
if (r2Vars.length > 0) {
  console.log('📋 Variáveis R2 encontradas no arquivo:');
  r2Vars.forEach((key) => {
    const value = result.env[key];
    const preview = value.length > 30 ? value.substring(0, 30) + '...' : value;
    console.log(`   ${key}=${preview}`);
  });
  console.log('');
} else {
  console.log('⚠️  Nenhuma variável R2_* encontrada no arquivo.');
  console.log('📝 Todas as chaves encontradas (primeiras 20):');
  const allKeys = Object.keys(result.env).slice(0, 20);
  allKeys.forEach((key) => {
    console.log(`   ${key}`);
  });
  if (Object.keys(result.env).length > 20) {
    console.log(`   ... e mais ${Object.keys(result.env).length - 20} variáveis`);
  }
  console.log('');
}

let hasErrors = false;
const warnings = [];

validators.forEach(({ name, description, validate, hint }) => {
  const value = result.env[name];

  if (!value) {
    hasErrors = true;
    console.log(`❌ ${name}: não definido`);
    console.log(`   ${description}`);
    console.log(`   → ${hint}\n`);
    return;
  }

  const trimmedValue = value.trim();
  if (validate && !validate(trimmedValue)) {
    warnings.push(name);
    console.log(`⚠️  ${name}: formato pode estar incorreto`);
    console.log(`   ${description}`);
    const preview = trimmedValue.length > 50 ? trimmedValue.substring(0, 50) + '...' : trimmedValue;
    console.log(`   Valor atual: ${preview} (${trimmedValue.length} caracteres)`);
    console.log(`   → ${hint}\n`);
    return;
  }

  const preview = trimmedValue.length > 40 ? trimmedValue.substring(0, 40) + '...' : trimmedValue;
  console.log(`✅ ${name}: OK (${trimmedValue.length} caracteres)`);
  console.log(`   ${preview}\n`);
});

console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Existem variáveis obrigatórias ausentes.');
  console.log('\n📝 Adicione as seguintes variáveis ao seu .env.local:');
  console.log('');
  validators.forEach(({ name, hint }) => {
    if (!result.env[name]) {
      console.log(`${name}=`);
    }
  });
  console.log('\n💡 Dica: Configure essas variáveis no painel do Cloudflare R2');
  console.log('   e adicione-as ao arquivo .env.local');
  process.exit(1);
}

if (warnings.length > 0) {
  console.log('⚠️  Todas as variáveis existem, mas revise os avisos acima.');
  console.log('✅ Todas as variáveis obrigatórias estão definidas');
  process.exit(0);
}

console.log('✅ Tudo certo! Configuração R2 parece consistente.');
console.log('='.repeat(50));
