#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const envFiles = ['.env.local', '.env'];

console.log('🔍 Verificando MONGODB_URI...\n');

let found = false;

for (const file of envFiles) {
  const filePath = join(rootDir, file);
  if (existsSync(filePath)) {
    console.log(`📄 Verificando arquivo: ${file}`);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check if this line contains MONGODB_URI
        if (trimmed.startsWith('MONGODB_URI') || trimmed.startsWith('# MONGODB_URI')) {
          console.log(`\n   Linha ${i + 1}: ${line}`);

          if (trimmed.startsWith('#')) {
            console.log('   ⚠️  Esta linha está comentada!');
            continue;
          }

          const [key, ...valueParts] = trimmed.split('=');
          if (key.trim() === 'MONGODB_URI' && valueParts.length > 0) {
            const value = valueParts.join('=').trim();

            // Remove quotes if present
            const cleanValue = value.replace(/^["']|["']$/g, '');

            console.log(
              `\n   Valor encontrado: ${cleanValue.substring(0, 50)}${
                cleanValue.length > 50 ? '...' : ''
              }`
            );
            console.log(`   Comprimento: ${cleanValue.length} caracteres`);

            // Check format
            if (!cleanValue.startsWith('mongodb://') && !cleanValue.startsWith('mongodb+srv://')) {
              console.log('\n   ❌ PROBLEMA: URI não começa com mongodb:// ou mongodb+srv://');
              console.log('\n   💡 Formato correto:');
              console.log(
                '      Para MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/'
              );
              console.log('      Para MongoDB local: mongodb://localhost:27017');

              // Check for common issues
              if (cleanValue.includes('@') && !cleanValue.startsWith('mongodb')) {
                console.log(
                  '\n   💡 Dica: Parece que você tem um URI do Atlas, mas está faltando o prefixo "mongodb+srv://"'
                );
              }
              if (cleanValue.startsWith('http')) {
                console.log('\n   💡 Dica: MongoDB URI não usa http:// ou https://');
              }
            } else {
              console.log('\n   ✅ Formato correto!');
              found = true;

              // Show masked version
              const masked = cleanValue.replace(/:([^:@]+)@/, ':****@');
              console.log(`   URI mascarada: ${masked}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao ler ${file}:`, error.message);
    }
  }
}

if (!found) {
  console.log('\n❌ MONGODB_URI não encontrado nos arquivos .env ou .env.local');
  console.log('\n💡 Adicione no seu arquivo .env.local:');
  console.log('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/');
  console.log('   ou');
  console.log('   MONGODB_URI=mongodb://localhost:27017');
}

console.log('');
