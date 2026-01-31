/**
 * Test script to verify APIFree.ai Seedream API
 * Run with: npx tsx scripts/test-seedream-api.ts
 */

import 'dotenv/config';

const APIFREE_BASE = 'https://api.apifree.ai';
const API_KEY = process.env.APIFREE_API_KEY;

async function testSeedreamAPI() {
    console.log('🎨 Testing APIFree.ai Seedream API...\n');

    if (!API_KEY) {
        console.error('❌ APIFREE_API_KEY not found in environment variables!');
        console.log('   Add it to your .env.local file:');
        console.log('   APIFREE_API_KEY=sk-xxxxxxxxxxxx');
        process.exit(1);
    }

    console.log(`✅ API Key found: ${API_KEY.substring(0, 10)}...`);

    // Step 1: Submit request
    console.log('\n📤 Step 1: Submitting image generation request...');

    const submitBody = {
        model: 'bytedance/seedream-4.5',
        prompt: 'A simple red cube on a white background, 3D render, minimal',
        size: '2K',
    };

    try {
        const submitResponse = await fetch(`${APIFREE_BASE}/v1/image/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(submitBody),
        });

        console.log(`   Response status: ${submitResponse.status}`);

        const submitData = await submitResponse.json();
        console.log('   Response:', JSON.stringify(submitData, null, 2));

        if (submitData.code !== 200) {
            console.error(`\n❌ Submit failed: ${submitData.code_msg || 'Unknown error'}`);
            process.exit(1);
        }

        const requestId = submitData.resp_data?.request_id;
        console.log(`\n✅ Request submitted! ID: ${requestId}`);

        // Step 2: Poll for result
        console.log('\n⏳ Step 2: Polling for result...');

        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
            attempts++;

            const resultResponse = await fetch(`${APIFREE_BASE}/v1/image/${requestId}/result`, {
                headers: { 'Authorization': `Bearer ${API_KEY}` },
            });

            const resultData = await resultResponse.json();
            const status = resultData.resp_data?.status;

            console.log(`   Attempt ${attempts}: ${status}`);

            if (status === 'success') {
                const imageUrl = resultData.resp_data?.image_list?.[0];
                console.log(`\n🎉 SUCCESS! Image generated.`);
                console.log(`   URL: ${imageUrl}`);
                console.log(`   Cost: $${resultData.resp_data?.usage?.cost || 0}`);
                process.exit(0);
            }

            if (status === 'error' || status === 'failed') {
                console.error(`\n❌ Generation failed: ${resultData.resp_data?.error}`);
                process.exit(1);
            }
        }

        console.error('\n❌ Timeout: Image generation took too long');
        process.exit(1);

    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

testSeedreamAPI();
