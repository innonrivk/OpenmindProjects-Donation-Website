import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, '../src/index.js');

const TEST_PORT = '3002';
const HEALTH_URL = `http://localhost:${TEST_PORT}/api/v1/health`;

async function waitUrl(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (err) {
      // Ignored: server not started yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function runSuite(suiteName, filePath) {
  return new Promise((resolvePromise) => {
    console.log(`\n🏃 Running Suite: ${suiteName} (${filePath})`);
    const child = spawn('node', ['--test', filePath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_PORT,
        NODE_ENV: 'test',
      },
    });

    child.on('close', (code) => {
      resolvePromise(code === 0);
    });
  });
}

async function main() {
  console.log('🧪 Starting OMP Test Suite Runner...');

  // 1. Spawn the backend server on a test port
  console.log(`🚀 Starting test server on port ${TEST_PORT}...`);
  const server = spawn('node', [serverPath], {
    env: {
      ...process.env,
      PORT: TEST_PORT,
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./dev.db', // Use the configured dev sqlite db
    },
  });

  // Capture server output for debugging if needed
  server.stdout.on('data', (data) => {
    if (process.env.DEBUG_TEST_SERVER) {
      process.stdout.write(`[SERVER] ${data}`);
    }
  });

  server.stderr.on('data', (data) => {
    process.stderr.write(`[SERVER ERROR] ${data}`);
  });

  let serverStarted = false;
  try {
    // 2. Wait for server health endpoint to be responsive
    serverStarted = await waitUrl(HEALTH_URL);
    if (!serverStarted) {
      console.error('🚨 Test server failed to start or health check timed out.');
      server.kill();
      process.exit(1);
    }
    console.log('🔌 Test server is healthy and listening!\n');

    // 3. Run all test files
    const unitSuccess = await runSuite('Unit Tests', resolve(__dirname, 'unit/middleware.test.js'));
    const rbacUnitSuccess = await runSuite('RBAC Unit Tests', resolve(__dirname, 'unit/rbac.test.js'));
    const integrationSuccess = await runSuite('Integration Tests', resolve(__dirname, 'integration/api.test.js'));
    const rbacIntegrationSuccess = await runSuite('RBAC Integration Tests', resolve(__dirname, 'integration/rbac.test.js'));
    const edgeSuccess = await runSuite('Edge-Case Tests', resolve(__dirname, 'edge/attacks.test.js'));
    const tracksSuccess = await runSuite('Donation Track Tests', resolve(__dirname, 'edge/tracks.test.js'));
    const envSuccess = await runSuite('Env Edge-Case Tests', resolve(__dirname, 'edge/env.test.js'));
    const tierAssignmentSuccess = await runSuite('Tier Assignment Tests', resolve(__dirname, 'unit/tierAssignment.test.js'));
    const tiersIntegrationSuccess = await runSuite('Tiers E2E Integration Tests', resolve(__dirname, 'edge/tiers.test.js'));
    const subUpdateSuccess = await runSuite('Subscription Update (No Card Re-entry)', resolve(__dirname, 'edge/subscription_update.test.js'));
    const commsSuccess = await runSuite('Communications Flow Tests', resolve(__dirname, 'edge/communications.test.js'));

    console.log('\n📊 Test execution summary:');
    console.log(`   Unit Tests:             ${unitSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   RBAC Unit Tests:        ${rbacUnitSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Integration Tests:      ${integrationSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   RBAC Integration Tests: ${rbacIntegrationSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Edge-Case Tests:        ${edgeSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Donation Tracks:        ${tracksSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Env Edge Tests:         ${envSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Tier Assignment:        ${tierAssignmentSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Tiers Integration:      ${tiersIntegrationSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Sub Update (No Card):   ${subUpdateSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Communications:         ${commsSuccess ? '✅ PASS' : '❌ FAIL'}`);

    if (unitSuccess && rbacUnitSuccess && integrationSuccess && rbacIntegrationSuccess && edgeSuccess && tracksSuccess && envSuccess && tierAssignmentSuccess && tiersIntegrationSuccess && subUpdateSuccess && commsSuccess) {
      console.log('\n🎉 ALL TEST SUITES PASSED SUCCESSFULLY!');
      server.kill();
      process.exit(0);
    } else {
      console.error('\n🚨 SOME TEST SUITES FAILED!');
      server.kill();
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error during test run execution:', err);
    server.kill();
    process.exit(1);
  }
}

main();
