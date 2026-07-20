import { spawn, execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execPath } from 'process';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const serverDir = resolve(__dirname, '..');
const serverPath = resolve(serverDir, 'src/index.js');

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

function runSuite(suiteName, filePath, databaseUrl) {
  return new Promise((resolvePromise) => {
    console.log(`\n🏃 Running Suite: ${suiteName} (${filePath})`);
    const child = spawn(execPath, ['--test', filePath], {
      stdio: 'inherit',
      cwd: serverDir,
      env: {
        ...process.env,
        TEST_PORT,
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        REDIS_URL: '', // Disable Redis in tests to prevent connection hangs
      },
    });

    child.on('close', (code) => {
      resolvePromise(code === 0);
    });
  });
}

async function main() {
  console.log('🧪 Starting OMP Test Suite Runner...');

  const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://omp_user:omp_dev_password@localhost:5432/omp_test';

  // 0. Perform Database reset
  console.log('🔄 Resetting test database schema...');
  try {
    execSync('npx prisma db push --force-reset', {
      stdio: 'inherit',
      cwd: serverDir,
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
      },
    });
    console.log('🌱 Seeding test database...');
    execSync('node prisma/seed.js', {
      stdio: 'inherit',
      cwd: serverDir,
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
      },
    });
    console.log('✅ Test database reset and seed completed successfully!');
  } catch (err) {
    console.error('🚨 Failed to reset/seed test database:', err.message);
    process.exit(1);
  }

  // 1. Spawn the backend server on a test port
  console.log(`🚀 Starting test server on port ${TEST_PORT}...`);
  const server = spawn(execPath, [serverPath], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: TEST_PORT,
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: '', // Disable Redis in test server to prevent connection hangs
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
    const unitSuccess = await runSuite('Unit Tests', resolve(__dirname, 'unit/middleware.test.js'), TEST_DATABASE_URL);
    const rbacUnitSuccess = await runSuite('RBAC Unit Tests', resolve(__dirname, 'unit/rbac.test.js'), TEST_DATABASE_URL);
    const integrationSuccess = await runSuite('Integration Tests', resolve(__dirname, 'integration/api.test.js'), TEST_DATABASE_URL);
    const rbacIntegrationSuccess = await runSuite('RBAC Integration Tests', resolve(__dirname, 'integration/rbac.test.js'), TEST_DATABASE_URL);
    const edgeSuccess = await runSuite('Edge-Case Tests', resolve(__dirname, 'edge/attacks.test.js'), TEST_DATABASE_URL);
    const tracksSuccess = await runSuite('Donation Track Tests', resolve(__dirname, 'edge/tracks.test.js'), TEST_DATABASE_URL);
    const envSuccess = await runSuite('Env Edge-Case Tests', resolve(__dirname, 'edge/env.test.js'), TEST_DATABASE_URL);
    const tierAssignmentSuccess = await runSuite('Tier Assignment Tests', resolve(__dirname, 'unit/tierAssignment.test.js'), TEST_DATABASE_URL);
    const tiersIntegrationSuccess = await runSuite('Tiers E2E Integration Tests', resolve(__dirname, 'edge/tiers.test.js'), TEST_DATABASE_URL);
    const subUpdateSuccess = await runSuite('Subscription Update (No Card Re-entry)', resolve(__dirname, 'edge/subscription_update.test.js'), TEST_DATABASE_URL);
    const commsSuccess = await runSuite('Communications Flow Tests', resolve(__dirname, 'edge/communications.test.js'), TEST_DATABASE_URL);

    // New test suites
    const receiptSettingsSuccess = await runSuite('Receipt Settings Tests', resolve(__dirname, 'integration/receiptSettings.test.js'), TEST_DATABASE_URL);
    const allowedEmailsSuccess = await runSuite('Allowed Emails Tests', resolve(__dirname, 'integration/allowedEmails.test.js'), TEST_DATABASE_URL);
    const contentSuccess = await runSuite('Content CRUD Tests', resolve(__dirname, 'integration/content.test.js'), TEST_DATABASE_URL);
    const adminSettingsSuccess = await runSuite('Admin Settings Tests', resolve(__dirname, 'integration/adminSettings.test.js'), TEST_DATABASE_URL);
    const milestonesSuccess = await runSuite('Milestones Claim Tests', resolve(__dirname, 'integration/milestones.test.js'), TEST_DATABASE_URL);
    const exportSuccess = await runSuite('Transaction Export Edge Tests', resolve(__dirname, 'edge/transactionExport.test.js'), TEST_DATABASE_URL);
    const postgresSuccess = await runSuite('PostgreSQL-Specific Tests', resolve(__dirname, 'integration/postgres.test.js'), TEST_DATABASE_URL);

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
    console.log(`   Receipt Settings:       ${receiptSettingsSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Allowed Emails:         ${allowedEmailsSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Content CRUD:           ${contentSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Admin Settings:         ${adminSettingsSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Milestones Claim:       ${milestonesSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Transaction Export:     ${exportSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   PostgreSQL Specific:    ${postgresSuccess ? '✅ PASS' : '❌ FAIL'}`);

    const allSuccess =
      unitSuccess && rbacUnitSuccess && integrationSuccess && rbacIntegrationSuccess &&
      edgeSuccess && tracksSuccess && envSuccess && tierAssignmentSuccess &&
      tiersIntegrationSuccess && subUpdateSuccess && commsSuccess &&
      receiptSettingsSuccess && allowedEmailsSuccess && contentSuccess &&
      adminSettingsSuccess && milestonesSuccess && exportSuccess && postgresSuccess;

    if (allSuccess) {
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
