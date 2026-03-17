/**
 * Auth Flow Test Script
 * Run: node plugin/test-auth.js <email> <password>
 *
 * Tests the plugin auth endpoints against local server
 */

const API_BASE = 'http://localhost:3001/api';

async function testAuthFlow() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║     Plugin Auth Flow Test                 ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('Usage: node plugin/test-auth.js <email> <password>\n');
    console.log('Example: node plugin/test-auth.js user@example.com mypassword');
    process.exit(1);
  }

  console.log(`1. POST /api/auth/signin (email: ${email})`);
  console.log('   ─────────────────────────────────────────');

  try {
    // Step 1: Login
    const signinRes = await fetch(`${API_BASE}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const signinData = await signinRes.json();

    if (!signinRes.ok) {
      console.log(`   ❌ FAIL (${signinRes.status}): ${signinData.error || signinRes.statusText}`);
      if (signinRes.status === 429) {
        console.log('   → Rate limited. Wait a few minutes.');
      }
      if (signinRes.status === 401) {
        console.log('   → Invalid credentials or OAuth-only account.');
      }
      return;
    }

    if (!signinData.token) {
      console.log('   ❌ FAIL: No token in response');
      console.log('   Response:', JSON.stringify(signinData, null, 2));
      return;
    }

    console.log('   ✅ Token received');
    console.log(`   → user.email: ${signinData.user?.email}`);
    console.log(`   → user.name: ${signinData.user?.name || '(not set)'}\n`);

    // Step 2: Fetch auth status
    console.log('2. GET /api/plugin/auth/status');
    console.log('   ─────────────────────────────────────────');

    const statusRes = await fetch(`${API_BASE}/plugin/auth/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${signinData.token}`,
      },
    });

    const statusData = await statusRes.json();

    if (!statusRes.ok) {
      console.log(`   ❌ FAIL (${statusRes.status}): ${statusRes.statusText}`);
      return;
    }

    console.log('   ✅ Response received');
    console.log(`   → authenticated: ${statusData.authenticated}`);
    console.log(`   → email: ${statusData.email || '❌ MISSING'}`);
    console.log(`   → tier: ${statusData.subscriptionTier}`);
    console.log(`   → credits: ${statusData.creditsRemaining}/${statusData.monthlyCredits}`);
    console.log(`   → canGenerate: ${statusData.canGenerate}`);

    // Step 3: Test with invalid token
    console.log('\n3. GET /api/plugin/auth/status (invalid token)');
    console.log('   ─────────────────────────────────────────');

    const invalidRes = await fetch(`${API_BASE}/plugin/auth/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid.token.here',
      },
    });

    const invalidData = await invalidRes.json();
    console.log(`   → authenticated: ${invalidData.authenticated} (expected: false)`);
    console.log(`   → canGenerate: ${invalidData.canGenerate} (expected: true for BYOK)`);

    // Summary
    console.log('\n═══════════════════════════════════════════');
    if (!statusData.email) {
      console.log('⚠️  BUG: email missing from /plugin/auth/status');
      console.log('   Check server/routes/plugin.ts line ~1138');
    } else if (!statusData.authenticated) {
      console.log('⚠️  Token valid but not authenticated?');
    } else {
      console.log('✅ Auth flow working correctly!');
    }
    console.log('═══════════════════════════════════════════');

  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') {
      console.log('   ❌ Connection refused. Is the server running?');
      console.log('   → Run: npm run dev');
    } else {
      console.log('   ❌ ERROR:', error.message);
    }
  }
}

testAuthFlow();
