import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, '../src/index.js');
const testPath = resolve(__dirname, 'edge/communications.test.js');

const TEST_PORT = '3002';
const HEALTH_URL = `http://localhost:${TEST_PORT}/api/v1/health`;

async function waitUrl(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (err) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function main() {
  console.log('🚀 Starting server for single test run...');
  const server = spawn('node', [serverPath], {
    env: {
      ...process.env,
      PORT: TEST_PORT,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://omp_user:omp_dev_password@localhost:5432/omp_test',
      REDIS_URL: '',
    },
  });

  server.stdout.on('data', (data) => {
    process.stdout.write(`[SERVER] ${data}`);
  });

  server.stderr.on('data', (data) => {
    process.stderr.write(`[SERVER ERROR] ${data}`);
  });

  const healthy = await waitUrl(HEALTH_URL);
  if (!healthy) {
    console.error('Server failed to start');
    server.kill();
    process.exit(1);
  }

  console.log('Server is healthy! Running communications.test.js...');
  const child = spawn('node', ['--test', testPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_PORT,
      NODE_ENV: 'test',
      REDIS_URL: '',
    },
  });

  child.on('close', (code) => {
    console.log(`Test run finished with exit code ${code}`);
    server.kill();
    process.exit(code);
  });
}

main();
