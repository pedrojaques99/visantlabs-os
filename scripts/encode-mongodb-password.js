#!/usr/bin/env node

/**
 * Script para codificar senha do MongoDB e validar connection string
 * 
 * Uso:
 *   node scripts/encode-mongodb-password.js
 *   node scripts/encode-mongodb-password.js "sua-senha"
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function encodePassword(password) {
  return encodeURIComponent(password);
}

function validateConnectionString(uri) {
  const issues = [];
  
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    issues.push('❌ Connection string deve começar com mongodb:// ou mongodb+srv://');
  }
  
  if (uri.includes('<password>') || uri.includes('<username>')) {
    issues.push('❌ Connection string contém placeholders (<password> ou <username>). Substitua pelos valores reais!');
  }
  
  // Verificar caracteres especiais não codificados na parte da senha
  const passwordMatch = uri.match(/mongodb\+?srv?:\/\/([^:]+):([^@]+)@/);
  if (passwordMatch) {
    const password = passwordMatch[2];
    const specialChars = ['<', '>', '@', ':', '/', '#', '?', '&', '=', '%', ' '];
    const hasSpecialChars = specialChars.some(char => password.includes(char) && !password.includes(encodeURIComponent(char)));
    
    if (hasSpecialChars) {
      issues.push('⚠️  Senha contém caracteres especiais que podem precisar ser codificados');
      issues.push(`   Senha atual: ${password}`);
      issues.push(`   Senha codificada: ${encodePassword(password)}`);
    }
  }
  
  return issues;
}

function buildConnectionString(username, password, cluster, database = '', options = '') {
  const encodedPassword = encodePassword(password);
  const dbPart = database ? `/${database}` : '';
  const optionsPart = options ? (options.startsWith('?') ? options : `?${options}`) : '';
  
  return `mongodb+srv://${username}:${encodedPassword}@${cluster}${dbPart}${optionsPart}`;
}

async function main() {
  console.log('🔐 MongoDB Password Encoder & Connection String Validator\n');
  
  // Se senha foi passada como argumento
  if (process.argv[2]) {
    const password = process.argv[2];
    console.log(`Senha original: ${password}`);
    console.log(`Senha codificada: ${encodePassword(password)}\n`);
    
    rl.question('Deseja construir uma connection string completa? (s/n): ', async (answer) => {
      if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim') {
        await buildFullConnectionString();
      } else {
        rl.close();
      }
    });
    return;
  }
  
  // Modo interativo
  console.log('Escolha uma opção:');
  console.log('1. Codificar apenas a senha');
  console.log('2. Validar connection string existente');
  console.log('3. Construir connection string completa');
  console.log('4. Sair\n');
  
  rl.question('Opção (1-4): ', async (option) => {
    switch (option) {
      case '1':
        await encodePasswordOnly();
        break;
      case '2':
        await validateExistingConnectionString();
        break;
      case '3':
        await buildFullConnectionString();
        break;
      case '4':
        console.log('Até logo!');
        rl.close();
        break;
      default:
        console.log('Opção inválida!');
        rl.close();
    }
  });
}

function encodePasswordOnly() {
  rl.question('Digite a senha do MongoDB: ', (password) => {
    console.log(`\n✅ Senha original: ${password}`);
    console.log(`✅ Senha codificada: ${encodePassword(password)}\n`);
    console.log('💡 Use a senha codificada na connection string!\n');
    rl.close();
  });
}

function validateExistingConnectionString() {
  rl.question('Cole sua connection string: ', (uri) => {
    console.log('\n🔍 Validando connection string...\n');
    
    const issues = validateConnectionString(uri);
    
    if (issues.length === 0) {
      console.log('✅ Connection string parece estar correta!\n');
    } else {
      console.log('⚠️  Problemas encontrados:\n');
      issues.forEach(issue => console.log(`   ${issue}`));
      console.log('');
    }
    
    rl.close();
  });
}

async function buildFullConnectionString() {
  const username = await question('Username do MongoDB: ');
  const password = await question('Password do MongoDB: ');
  const cluster = await question('Cluster (ex: cluster0.abc123.mongodb.net): ');
  const database = await question('Database name (opcional, Enter para pular): ');
  const options = await question('Options (opcional, ex: retryWrites=true&w=majority, Enter para padrão): ');
  
  const defaultOptions = 'retryWrites=true&w=majority';
  const finalOptions = options || defaultOptions;
  
  const connectionString = buildConnectionString(
    username,
    password,
    cluster,
    database,
    finalOptions
  );
  
  console.log('\n✅ Connection string gerada:\n');
  console.log(connectionString);
  console.log('\n💡 Configure esta string como MONGODB_URI no Vercel!\n');
  
  rl.close();
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

main().catch(console.error);

