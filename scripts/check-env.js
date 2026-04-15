#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const maskValue = (value) => {
  if (!value) return '';
  if (value.length <= 8) return '********';
  return value.substring(0, 4) + '...' + value.substring(value.length - 4);
};

const requiredVars = [
  'GEMINI_API_KEY',
  'MONGODB_URI',
  'MONGODB_DB_NAME',
  'PORT',
  'FRONTEND_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
];

const envFiles = ['.env', '.env.local'];

console.log('🔍 Verificando arquivos de ambiente...\n');

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
  console.log('\n📝 Crie um arquivo .env.local na raiz do projeto com as seguintes variáveis:\n');
  requiredVars.forEach(varName => {
    console.log(`${varName}=`);
  });
  process.exit(1);
}

console.log('📋 Verificando variáveis de ambiente:\n');

let hasErrors = false;
const warnings = [];

// Verificar variáveis obrigatórias
for (const varName of requiredVars) {
  const value = envContent[varName];
  
  if (!value) {
    console.log(`❌ ${varName}: NÃO DEFINIDA`);
    hasErrors = true;
  } else {
    // Validações específicas
    let isWarning = false;
    if (varName === 'MONGODB_URI') {
      if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
        console.log(`⚠️  ${varName}: Formato pode estar incorreto (deve começar com mongodb:// ou mongodb+srv://)`);
        isWarning = true;
      }
    } else if (varName === 'GOOGLE_CLIENT_ID') {
      if (!value.includes('.apps.googleusercontent.com')) {
        console.log(`⚠️  ${varName}: Formato pode estar incorreto`);
        isWarning = true;
      }
    } else if (varName === 'GOOGLE_CLIENT_SECRET') {
      if (!value.startsWith('GOCSPX-')) {
        console.log(`⚠️  ${varName}: Formato pode estar incorreto (deve começar com GOCSPX-)`);
        isWarning = true;
      }
    } else if (varName === 'JWT_SECRET') {
      if (value === 'your-secret-key-change-in-production') {
        console.log(`⚠️  ${varName}: Usando valor padrão - ALTERE PARA PRODUÇÃO!`);
        isWarning = true;
      }
    } else if (varName === 'GOOGLE_REDIRECT_URI') {
      if (!value.includes('/api/auth/google/callback')) {
        console.log(`⚠️  ${varName}: Deve terminar com /api/auth/google/callback`);
        isWarning = true;
      }
    }

    if (isWarning) {
      warnings.push(varName);
    } else {
      // Secret masking for logs
      const isPublic = ['PORT', 'GOOGLE_REDIRECT_URI', 'MONGODB_DB_NAME'].includes(varName);
      const displayValue = isPublic ? value : maskValue(value);
      console.log(`✅ ${varName}: Definida (${displayValue})`);
    }
  }
}

// Verificar valores sensíveis que não devem estar expostos
console.log('\n🔒 Verificando segurança:\n');

if (envFile === '.env' && !existsSync(join(rootDir, '.gitignore'))) {
  console.log('⚠️  Arquivo .env não está no .gitignore - certifique-se de que está!');
  warnings.push('gitignore');
}

// Verificar se há valores placeholder
const placeholderValues = ['your-secret-key', 'your_', 'placeholder', 'example'];
for (const [key, value] of Object.entries(envContent)) {
  const lowerValue = value.toLowerCase();
  if (placeholderValues.some(placeholder => lowerValue.includes(placeholder))) {
    if (key !== 'JWT_SECRET' || value !== 'your-secret-key-change-in-production') {
      console.log(`⚠️  ${key}: Pode conter valor placeholder`);
      warnings.push(key);
    }
  }
}

// Resumo
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ ERROS ENCONTRADOS: Corrija as variáveis marcadas acima');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('⚠️  AVISOS: Verifique as variáveis marcadas acima');
  console.log('✅ Todas as variáveis obrigatórias estão definidas');
} else {
  console.log('✅ TUDO OK! Todas as variáveis estão configuradas corretamente');
}
console.log('='.repeat(50) + '\n');


