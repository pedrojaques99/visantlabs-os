#!/usr/bin/env node
import net from 'net';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port, '0.0.0.0');
  });
}

async function findFreePort(start = 3001, max = 3010) {
  for (let port = start; port <= max; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found between ${start} and ${max}`);
}

// Start from 3100 to avoid collision with vite (which uses 3000+)
const port = await findFreePort(3100, 3110);
console.log(`[dev] Server will use port ${port}`);

// Patch .env.local so vite.config.ts picks up SERVER_PORT at load time
const envPath = '.env.local';
let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
envContent = envContent.replace(/^SERVER_PORT=.*/m, '').replace(/^\n+/, '');
envContent = `SERVER_PORT=${port}\n` + envContent;
writeFileSync(envPath, envContent, 'utf8');

const env = { ...process.env, PORT: String(port), SERVER_PORT: String(port) };
const colors = { vite: '\x1b[36m', server: '\x1b[33m', reset: '\x1b[0m' };

function spawnNamed(name, cmd) {
  const color = colors[name] || '';
  const proc = spawn(cmd, { env, stdio: ['ignore', 'pipe', 'pipe'], shell: true });
  proc.stdout.on('data', (d) => process.stdout.write(`${color}[${name}]${colors.reset} ${d}`));
  proc.stderr.on('data', (d) => process.stderr.write(`${color}[${name}]${colors.reset} ${d}`));
  proc.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
    process.exit(code ?? 0);
  });
  return proc;
}

spawnNamed('server', 'npm run dev:server');

// Small delay so vite reads the updated .env.local after server starts
setTimeout(() => spawnNamed('vite', 'npm run dev'), 500);
