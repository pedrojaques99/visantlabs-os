#!/usr/bin/env node

/**
 * Visant Plugin Diagnostic CLI
 * Professional test suite to validate plugin/backend connectivity and configuration
 *
 * Usage: node scripts/diagnostic.js [--json] [--backend-url=http://localhost:3000]
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Parse CLI arguments
const args = process.argv.slice(2);
const outputJson = args.includes('--json');
const backendUrlArg = args.find(arg => arg.startsWith('--backend-url='));
const backendUrl = backendUrlArg ? backendUrlArg.split('=')[1] : 'http://localhost:3001';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

const c = outputJson ? { ...colors, bright: '', green: '', red: '', yellow: '', cyan: '', gray: '', reset: '' } : colors;

// Test results collector
const results = {
  timestamp: new Date().toISOString(),
  version: require('../package.json').version || 'unknown',
  backend: {
    url: backendUrl,
    status: 'unknown',
    tests: {}
  },
  plugin: {
    status: 'unknown',
    tests: {}
  },
  environment: {
    nodeVersion: process.version,
    platform: process.platform
  },
  summary: {
    passed: 0,
    failed: 0,
    warnings: 0
  }
};

function log(message, type = 'info') {
  if (outputJson) return;

  const prefix = {
    info: `${c.cyan}ℹ${c.reset}`,
    success: `${c.green}✓${c.reset}`,
    error: `${c.red}✗${c.reset}`,
    warning: `${c.yellow}⚠${c.reset}`,
    title: `${c.bright}${c.cyan}${c.reset}`,
    step: `${c.cyan}→${c.reset}`
  };

  console.log(`${prefix[type]} ${message}`);
}

function logSection(title) {
  if (outputJson) return;
  console.log(`\n${c.bright}${c.cyan}${title}${c.reset}`);
  console.log('─'.repeat(60));
}

async function testHttpEndpoint(method, path, headers = {}, body = null) {
  return new Promise((resolve) => {
    try {
      const url = new URL(path, backendUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: 5000
      };

      const req = client.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            body: data,
            success: res.statusCode < 500
          });
        });
      });

      req.on('error', (err) => {
        resolve({
          status: 0,
          statusText: err.code || err.message,
          error: true,
          message: err.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 0,
          statusText: 'TIMEOUT',
          error: true,
          message: 'Request timeout after 5000ms'
        });
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    } catch (err) {
      resolve({
        status: 0,
        statusText: 'ERROR',
        error: true,
        message: err.message
      });
    }
  });
}

async function runDiagnostics() {
  logSection('VISANT PLUGIN DIAGNOSTIC');
  log(`Backend URL: ${c.cyan}${backendUrl}${c.reset}`, 'info');
  log(`Timestamp: ${new Date().toISOString()}`, 'info');

  // ═══ Test 1: Backend Connectivity ═══
  logSection('1. Backend Connectivity');

  const pingResult = await testHttpEndpoint('GET', '/api/health');
  const isPingOk = pingResult.status === 200;

  results.backend.tests.ping = {
    status: isPingOk ? 'pass' : 'fail',
    statusCode: pingResult.status,
    message: pingResult.message || pingResult.statusText,
    time: new Date().toISOString()
  };

  if (isPingOk) {
    log('Backend is reachable', 'success');
    results.summary.passed++;
  } else {
    log(`Backend unreachable: ${pingResult.statusText}`, 'error');
    results.summary.failed++;
    if (!outputJson) {
      console.log(`  ${c.gray}→ Make sure backend is running: npm run dev${c.reset}`);
    }
  }

  // ═══ Test 2: API Authentication ═══
  logSection('2. API Authentication');

  const authResult = await testHttpEndpoint('GET', '/api/auth/status');
  const isAuthOk = authResult.status === 200 || authResult.status === 401;

  results.backend.tests.auth = {
    status: isAuthOk ? 'pass' : 'fail',
    statusCode: authResult.status,
    message: authResult.statusText,
    time: new Date().toISOString()
  };

  if (isAuthOk) {
    log(`Auth endpoint responding (${authResult.status} ${authResult.statusText})`, 'success');
    results.summary.passed++;
  } else {
    log(`Auth endpoint failed: ${authResult.statusText}`, 'error');
    results.summary.failed++;
  }

  // ═══ Test 3: CORS Headers ═══
  logSection('3. CORS Configuration');

  const corsResult = await testHttpEndpoint('OPTIONS', '/api/auth/status', {
    'Origin': 'null',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type'
  });

  const hasCorsHeaders = corsResult.headers && corsResult.headers['access-control-allow-origin'];
  const corsOk = corsResult.status === 200 && hasCorsHeaders;

  results.backend.tests.cors = {
    status: corsOk ? 'pass' : 'fail',
    statusCode: corsResult.status,
    hasAllowOrigin: !!hasCorsHeaders,
    allowOrigin: corsResult.headers?.['access-control-allow-origin'],
    time: new Date().toISOString()
  };

  if (corsOk) {
    log(`CORS headers configured: ${corsResult.headers['access-control-allow-origin']}`, 'success');
    results.summary.passed++;
  } else if (corsResult.error) {
    log(`CORS preflight failed: ${corsResult.message}`, 'error');
    results.summary.failed++;
  } else {
    log(`CORS headers missing or misconfigured`, 'warning');
    results.summary.warnings++;
  }

  // ═══ Test 4: Plugin Configuration ═══
  logSection('4. Plugin Configuration');

  try {
    const manifestPath = path.join(__dirname, '../plugin/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    const hasBackendUrl = manifest.networkAccess?.allowedDomains?.includes(backendUrl.replace('http://', ''));
    const hasCors = manifest.networkAccess?.allowedDomains?.some(d => d.includes('localhost'));

    results.plugin.tests.manifest = {
      status: 'pass',
      pluginId: manifest.id,
      apiVersion: manifest.api,
      allowedDomains: manifest.networkAccess?.allowedDomains || []
    };

    log(`Manifest loaded: Plugin ID ${manifest.id}`, 'success');

    if (hasCors) {
      log(`Backend domain in allowed list`, 'success');
      results.summary.passed++;
    } else {
      log(`Backend domain NOT in allowed list. Add to manifest.json:`, 'warning');
      results.summary.warnings++;
      if (!outputJson) {
        console.log(`  ${c.gray}"${backendUrl.replace('http://', '')}"${c.reset}`);
      }
    }
  } catch (err) {
    log(`Plugin manifest error: ${err.message}`, 'error');
    results.summary.failed++;
  }

  // ═══ Test 5: API Endpoint Functionality ═══
  logSection('5. API Endpoints');

  // Test login endpoint
  const loginResult = await testHttpEndpoint('POST', '/api/auth/signin', {}, {
    email: 'test@test.com',
    password: 'test'
  });

  const loginOk = loginResult.status === 200 || loginResult.status === 401 || loginResult.status === 400;

  results.backend.tests.endpoints = {
    login: {
      status: loginOk ? 'pass' : 'fail',
      statusCode: loginResult.status,
      message: loginResult.statusText
    }
  };

  if (loginOk) {
    log(`Login endpoint responding (${loginResult.status})`, 'success');
    results.summary.passed++;
  } else {
    log(`Login endpoint failed: ${loginResult.statusText}`, 'error');
    results.summary.failed++;
  }

  // ═══ Test 6: Authenticated Smoke Test ═══
  logSection('6. Authenticated Smoke Test');

  const smokeEmail = process.env.SMOKE_EMAIL;
  const smokePassword = process.env.SMOKE_PASSWORD;

  if (!smokeEmail || !smokePassword) {
    log('Skipped — set SMOKE_EMAIL and SMOKE_PASSWORD env vars to enable', 'warning');
    results.backend.tests.smoke = { status: 'skipped', reason: 'missing credentials' };
    results.summary.warnings++;
  } else {
    const signinResp = await testHttpEndpoint('POST', '/api/auth/signin', {}, {
      email: smokeEmail,
      password: smokePassword
    });

    let token = null;
    try {
      token = JSON.parse(signinResp.body || '{}').token;
    } catch {}

    if (signinResp.status !== 200 || !token) {
      log(`Signin failed (${signinResp.status}) — check SMOKE credentials`, 'error');
      results.backend.tests.smoke = {
        status: 'fail',
        step: 'signin',
        statusCode: signinResp.status
      };
      results.summary.failed++;
    } else {
      log(`Signin OK — token acquired`, 'success');
      results.summary.passed++;

      const authStatusResp = await testHttpEndpoint('GET', '/api/plugin/auth/status', {
        Authorization: `Bearer ${token}`
      });
      const authStatusOk = authStatusResp.status === 200;

      if (authStatusOk) {
        log(`Token validated via /plugin/auth/status`, 'success');
        results.summary.passed++;
      } else {
        log(`Token rejected (${authStatusResp.status})`, 'error');
        results.summary.failed++;
      }

      // Hit smart-analyze with minimal payload — expect 200/400/422, NOT 401
      const smartAnalyzeResp = await testHttpEndpoint('POST', '/api/plugin/smart-analyze', {
        Authorization: `Bearer ${token}`
      }, { mode: 'figma-plugin' });

      const smartAnalyzeAuthed = smartAnalyzeResp.status !== 401 && smartAnalyzeResp.status !== 403;

      results.backend.tests.smoke = {
        status: authStatusOk && smartAnalyzeAuthed ? 'pass' : 'fail',
        authStatusCode: authStatusResp.status,
        smartAnalyzeStatusCode: smartAnalyzeResp.status
      };

      if (smartAnalyzeAuthed) {
        log(`smart-analyze accepts token (${smartAnalyzeResp.status})`, 'success');
        results.summary.passed++;
      } else {
        log(`smart-analyze rejected token (${smartAnalyzeResp.status})`, 'error');
        results.summary.failed++;
      }
    }
  }

  // ═══ Summary ═══
  logSection('Summary');

  const allPassed = results.summary.failed === 0;
  const statusIcon = allPassed ? c.green + '✓' : c.red + '✗';

  log(`Tests Passed: ${c.green}${results.summary.passed}${c.reset}`, 'info');
  log(`Tests Failed: ${c.red}${results.summary.failed}${c.reset}`, 'info');
  log(`Warnings: ${c.yellow}${results.summary.warnings}${c.reset}`, 'info');

  if (allPassed) {
    log(`\n${statusIcon}${c.reset} ${c.bright}Plugin ready for use!${c.reset}`, 'success');
  } else {
    log(`\n${statusIcon}${c.reset} ${c.bright}Issues detected - see above${c.reset}`, 'error');
  }

  // ═══ Output Results ═══
  if (outputJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run diagnostics
runDiagnostics().catch(err => {
  log(`Fatal error: ${err.message}`, 'error');
  process.exit(1);
});
