#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const envFiles = ['.env.local', '.env'];

console.log('🔍 Verificando configuração do Stripe...\n');

let envContent = {};

for (const file of envFiles) {
  const filePath = join(rootDir, file);
  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            envContent[key.trim()] = value;
          }
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao ler ${file}:`, error.message);
    }
  }
}

// Check required Stripe variables
const stripeVars = {
  // Backend variables (server-side)
  'STRIPE_SECRET_KEY': {
    required: true,
    pattern: /^sk_(test_|live_)/,
    example: 'sk_test_51AbCdEf...',
    description: 'Secret key do Stripe (backend)'
  },
  'STRIPE_PRICE_ID_USD': {
    required: true,
    pattern: /^price_/,
    example: 'price_1234567890abcdef',
    description: 'Price ID para USD'
  },
  'STRIPE_PRICE_ID_BRL': {
    required: false,
    pattern: /^price_/,
    example: 'price_1234567890abcdef',
    description: 'Price ID para BRL (opcional)'
  },
  'STRIPE_WEBHOOK_SECRET': {
    required: false,
    pattern: /^whsec_/,
    example: 'whsec_1234567890abcdef',
    description: 'Webhook secret (opcional, necessário para webhooks)'
  },
  // Frontend variables (client-side)
  'VITE_STRIPE_PUBLISHABLE_KEY': {
    required: true,
    pattern: /^pk_(test_|live_)/,
    example: 'pk_test_51AbCdEf...',
    description: 'Publishable key do Stripe (frontend)'
  }
};

console.log('📋 Verificando variáveis de ambiente:\n');

let hasErrors = false;
let hasWarnings = false;

// Check backend variables
console.log('🔒 Variáveis do Backend (server-side):\n');
for (const [varName, config] of Object.entries(stripeVars)) {
  if (varName.startsWith('VITE_')) continue; // Skip frontend vars for now
  
  const value = envContent[varName];
  
  if (!value) {
    if (config.required) {
      console.log(`❌ ${varName}: NÃO DEFINIDA`);
      console.log(`   Descrição: ${config.description}`);
      hasErrors = true;
    } else {
      console.log(`⚠️  ${varName}: Não definida (opcional)`);
      console.log(`   Descrição: ${config.description}`);
      hasWarnings = true;
    }
  } else {
    if (config.pattern && !config.pattern.test(value)) {
      console.log(`⚠️  ${varName}: Formato pode estar incorreto`);
      console.log(`   Valor atual: ${value.substring(0, 30)}...`);
      console.log(`   Formato esperado: ${config.example}`);
      hasWarnings = true;
    } else {
      // Mask sensitive values
      let displayValue = value;
      if (varName === 'STRIPE_SECRET_KEY') {
        displayValue = value.substring(0, 12) + '...';
      } else if (varName === 'STRIPE_WEBHOOK_SECRET') {
        displayValue = value.substring(0, 12) + '...';
      }
      console.log(`✅ ${varName}: Definida (${displayValue})`);
    }
  }
}

// Check frontend variables
console.log('\n🌐 Variáveis do Frontend (client-side):\n');
const viteVar = 'VITE_STRIPE_PUBLISHABLE_KEY';
const config = stripeVars[viteVar];
const value = envContent[viteVar];

if (!value) {
  console.log(`❌ ${viteVar}: NÃO DEFINIDA`);
  console.log(`   Descrição: ${config.description}`);
  console.log(`   ⚠️  Esta variável é necessária para pagamentos funcionarem no frontend`);
  hasErrors = true;
} else {
  if (config.pattern && !config.pattern.test(value)) {
    console.log(`⚠️  ${viteVar}: Formato pode estar incorreto`);
    console.log(`   Valor atual: ${value.substring(0, 30)}...`);
    console.log(`   Formato esperado: ${config.example}`);
    hasWarnings = true;
  } else {
    const displayValue = value.substring(0, 20) + '...';
    console.log(`✅ ${viteVar}: Definida (${displayValue})`);
  }
}

// Instructions
console.log('\n📝 Como configurar o Stripe:\n');

if (hasErrors || hasWarnings) {
  console.log('1. Acesse o Stripe Dashboard:');
  console.log('   https://dashboard.stripe.com/test/apikeys');
  console.log('\n2. Copie as chaves:');
  console.log('   • Publishable key (pk_test_...) → VITE_STRIPE_PUBLISHABLE_KEY no .env');
  console.log('   • Secret key (sk_test_...) → STRIPE_SECRET_KEY no .env.local');
  console.log('\n3. Configure os produtos e preços:');
  console.log('   https://dashboard.stripe.com/test/products');
  console.log('   • Crie um produto');
  console.log('   • Adicione preços (USD e BRL se necessário)');
  console.log('   • Copie os Price IDs → STRIPE_PRICE_ID_USD e STRIPE_PRICE_ID_BRL');
  console.log('\n4. Para webhooks (opcional):');
  console.log('   https://dashboard.stripe.com/test/webhooks');
  console.log('   • Crie um webhook endpoint');
  console.log('   • Copie o webhook secret → STRIPE_WEBHOOK_SECRET');
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('❌ ERROS ENCONTRADOS: Configure as variáveis marcadas acima');
  console.log('\n💡 Dica: Variáveis VITE_* devem estar no arquivo .env (não .env.local)');
  console.log('   Variáveis sem VITE_ devem estar no .env.local');
} else if (hasWarnings) {
  console.log('⚠️  AVISOS: Verifique as configurações marcadas acima');
  console.log('✅ Configuração básica está OK');
} else {
  console.log('✅ TUDO OK! Configuração do Stripe está completa');
}
console.log('='.repeat(60) + '\n');

