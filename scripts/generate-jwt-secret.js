#!/usr/bin/env node

import { randomBytes } from 'crypto';

console.log('🔐 Gerando chave JWT_SECRET segura...\n');

// Gera uma chave aleatória de 32 bytes (256 bits) em base64
const jwtSecret = randomBytes(32).toString('base64');

console.log('✅ Chave gerada com sucesso!\n');
console.log('📋 Adicione esta linha no seu arquivo .env ou .env.local:\n');
console.log(`JWT_SECRET=${jwtSecret}\n`);
console.log('⚠️  IMPORTANTE:');
console.log('   - Mantenha esta chave em segredo');
console.log('   - NÃO compartilhe ou commite no Git');
console.log('   - Use a mesma chave em todos os ambientes (dev/prod)');
console.log('   - Se perder a chave, todos os tokens existentes serão inválidos\n');
