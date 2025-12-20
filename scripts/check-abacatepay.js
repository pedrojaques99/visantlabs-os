#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const envFiles = ['.env', '.env.local'];

console.log('🔍 Verificando configuração do AbacatePay...\n');

let envFile = null;
let envContent = {};

for (const file of envFiles) {
  const filePath = join(rootDir, file);
  if (existsSync(filePath)) {
    envFile = file;
    console.log(`✅ Arquivo encontrado: ${file}\n`);
    
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            envContent[key.trim()] = value;
          }
        }
      }
      break;
    } catch (error) {
      console.error(`❌ Erro ao ler ${file}:`, error.message);
    }
  }
}

if (!envFile) {
  console.error('❌ Nenhum arquivo .env ou .env.local encontrado!');
  process.exit(1);
}

console.log('📋 Verificando variáveis do AbacatePay:\n');

// Verificar ABACATEPAY_API_KEY ou ABACATEPAY_API_KEY
const apiKey = envContent['ABACATEPAY_API_KEY'] || envContent['ABACATEPAY_API_KEY'];
if (apiKey) {
  console.log(`✅ API Key: Definida (${apiKey.substring(0, 15)}...)`);
  if (apiKey.startsWith('abc_')) {
    console.log('   ✅ Formato correto (começa com abc_)');
  } else {
    console.log('   ⚠️  Formato pode estar incorreto (deve começar com abc_)');
  }
} else {
  console.log('❌ API Key: NÃO DEFINIDA');
  console.log('   Configure ABACATEPAY_API_KEY ou ABACATEPAY_API_KEY');
}

// Verificar ABACATE_WEBHOOK_SECRET ou ABACATEPAY_WEBHOOK_SECRET
const webhookSecret = envContent['ABACATE_WEBHOOK_SECRET'] || envContent['ABACATEPAY_WEBHOOK_SECRET'];
if (webhookSecret) {
  console.log(`✅ Webhook Secret: Definida`);
} else {
  console.log('⚠️  Webhook Secret: NÃO DEFINIDA (opcional, mas recomendado)');
}

// Verificar ABACATE_WEBHOOK_ID ou ABACATEPAY_WEBHOOK_ID
const webhookId = envContent['ABACATE_WEBHOOK_ID'] || envContent['ABACATEPAY_WEBHOOK_ID'];
if (webhookId) {
  console.log(`✅ Webhook ID: Definida`);
} else {
  console.log('⚠️  Webhook ID: NÃO DEFINIDA (opcional)');
}

// Verificar variáveis de produto (opcionais)
const productVars = Object.keys(envContent).filter(key => 
  key.startsWith('ABACATE_PRODUCT_') || key.startsWith('ABACATEPAY_PRODUCT_')
);
if (productVars.length > 0) {
  console.log(`\n📦 Variáveis de Produto encontradas (${productVars.length}):`);
  productVars.forEach(varName => {
    console.log(`   ✅ ${varName}`);
  });
} else {
  console.log('\n📦 Variáveis de Produto: Nenhuma definida (opcional)');
  console.log('   Você pode definir ABACATE_PRODUCT_20, ABACATE_PRODUCT_50, etc.');
}

console.log('\n' + '='.repeat(50));
if (!apiKey) {
  console.log('❌ ERRO: ABACATEPAY_API_KEY ou ABACATEPAY_API_KEY é obrigatória!');
  console.log('\n📝 Configure no Vercel:');
  console.log('   1. Vá para Settings > Environment Variables');
  console.log('   2. Adicione ABACATEPAY_API_KEY com sua chave');
  console.log('   3. Faça redeploy da aplicação');
  process.exit(1);
} else {
  console.log('✅ Configuração do AbacatePay está OK!');
  console.log('\n💡 Lembre-se:');
  console.log('   - Configure as variáveis no Vercel para produção');
  console.log('   - Faça redeploy após adicionar novas variáveis');
  console.log('   - Verifique se o webhook está configurado no dashboard do AbacatePay');
}
console.log('='.repeat(50) + '\n');


























