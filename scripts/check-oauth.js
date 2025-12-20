#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const envFiles = ['.env.local', '.env'];

console.log('🔍 Verificando configuração do Google OAuth...\n');

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

// Check required OAuth variables
const requiredVars = {
  'GOOGLE_CLIENT_ID': {
    required: true,
    pattern: /\.apps\.googleusercontent\.com$/,
    example: '123456789-abc123def456.apps.googleusercontent.com'
  },
  'GOOGLE_CLIENT_SECRET': {
    required: true,
    pattern: /^GOCSPX-/,
    example: 'GOCSPX-abc123def456ghi789'
  },
  'GOOGLE_REDIRECT_URI': {
    required: true,
    pattern: /\/api\/auth\/google\/callback$/,
    example: 'http://localhost:3001/api/auth/google/callback',
    validate: (value) => {
      if (value.includes('//api')) {
        return '⚠️  URI contém barra dupla (//) - remova a barra extra';
      }
      return null;
    }
  },
  'FRONTEND_URL': {
    required: true,
    pattern: /^https?:\/\//,
    example: 'http://localhost:3000'
  }
};

console.log('📋 Verificando variáveis de ambiente:\n');

let hasErrors = false;
let hasWarnings = false;

for (const [varName, config] of Object.entries(requiredVars)) {
  const value = envContent[varName];
  
  if (!value) {
    if (config.required) {
      console.log(`❌ ${varName}: NÃO DEFINIDA`);
      hasErrors = true;
    } else {
      console.log(`⚠️  ${varName}: Não definida (opcional)`);
      hasWarnings = true;
    }
  } else {
    // Check format
    if (config.pattern && !config.pattern.test(value)) {
      console.log(`⚠️  ${varName}: Formato pode estar incorreto`);
      console.log(`   Valor atual: ${value.substring(0, 60)}${value.length > 60 ? '...' : ''}`);
      console.log(`   Formato esperado: ${config.example}`);
      hasWarnings = true;
    } else {
      // Run custom validation if exists
      if (config.validate) {
        const validationError = config.validate(value);
        if (validationError) {
          console.log(`⚠️  ${varName}: ${validationError}`);
          console.log(`   Valor atual: ${value}`);
          console.log(`   Deveria ser: ${value.replace('//api', '/api')}`);
          hasWarnings = true;
        }
      }
      // Mask sensitive values
      let displayValue = value;
      if (varName === 'GOOGLE_CLIENT_SECRET') {
        displayValue = value.substring(0, 12) + '...';
      }
      console.log(`✅ ${varName}: Definida (${displayValue})`);
    }
  }
}

// Check OAuth Consent Screen configuration
console.log('\n📝 Checklist do Google Cloud Console:\n');

console.log('1. ✅ OAuth 2.0 Client ID criado');
console.log('   └─ Verifique em: https://console.cloud.google.com/apis/credentials');

console.log('\n2. ⚠️  OAuth Consent Screen configurado (OBRIGATÓRIO)');
console.log('   └─ Acesse: https://console.cloud.google.com/apis/credentials/consent');
console.log('   └─ Configure:');
console.log('      • App name');
console.log('      • User support email');
console.log('      • Scopes: email, profile');
console.log('      • Test users (se em Testing mode)');

console.log('\n3. ✅ Authorized redirect URIs');
const redirectUri = envContent['GOOGLE_REDIRECT_URI'];
if (redirectUri) {
  console.log(`   └─ Deve incluir: ${redirectUri}`);
  console.log('   └─ Adicione em: https://console.cloud.google.com/apis/credentials');
} else {
  console.log('   └─ ⚠️  GOOGLE_REDIRECT_URI não definido');
}

// Test connection
console.log('\n🔗 Testando configuração:\n');

const clientId = envContent['GOOGLE_CLIENT_ID'];
const clientSecret = envContent['GOOGLE_CLIENT_SECRET'];
const redirectUriValue = envContent['GOOGLE_REDIRECT_URI'];
const frontendUrl = envContent['FRONTEND_URL'];

if (clientId && clientSecret && redirectUriValue) {
  console.log('✅ Todas as credenciais estão definidas');
  console.log('\n📝 Próximos passos:');
  console.log('1. Verifique se o OAuth Consent Screen está configurado');
  console.log('2. Certifique-se de que o Redirect URI está autorizado no Google Cloud Console');
  console.log('3. Se o app estiver em "Testing" mode, adicione seu email como test user');
  console.log('4. Teste o login com: npm run dev:all');
} else {
  console.log('❌ Faltam credenciais necessárias');
  hasErrors = true;
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('❌ ERROS ENCONTRADOS: Corrija as variáveis marcadas acima');
  console.log('\n💡 Dica: Veja GOOGLE_OAUTH_SETUP.md para instruções detalhadas');
} else if (hasWarnings) {
  console.log('⚠️  AVISOS: Verifique as configurações marcadas acima');
  console.log('✅ Configuração básica está OK');
} else {
  console.log('✅ TUDO OK! Configuração do OAuth está correta');
  console.log('💡 Certifique-se de que o OAuth Consent Screen está configurado no Google Cloud Console');
}
console.log('='.repeat(60) + '\n');

