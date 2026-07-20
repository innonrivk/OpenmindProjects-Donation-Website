import '../../src/lib/env.js';
import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execPath } from 'process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envScriptPath = resolve(__dirname, '../../src/lib/env.js');
const emailScriptPath = resolve(__dirname, '../../src/services/email.js');

test('Env Dependency Verification', async (t) => {
  await t.test('Fails to start in production if JWT_SECRET is missing', (t, done) => {
    // Pass empty strings so dotenv does not load values from the root .env
    const child = spawn(execPath, [envScriptPath], {
      env: {
        NODE_ENV: 'production',
        JWT_SECRET: '',
        ADMIN_JWT_SECRET: 'admin_secret',
        STRIPE_SECRET_KEY: 'stripe_key',
        STRIPE_WEBHOOK_SECRET: 'wh_secret',
      },
    });

    let errOutput = '';
    child.stderr.on('data', (data) => {
      errOutput += data.toString();
    });

    child.on('close', (code) => {
      assert.strictEqual(code, 1);
      assert.ok(
        errOutput.includes('FATAL: Missing required environment variable: JWT_SECRET'),
        `Unexpected error output: ${errOutput}`
      );
      done();
    });
  });

  await t.test('Fails to load email service if SMTP settings are missing', (t, done) => {
    // Pass empty strings to trigger validation error
    const child = spawn(execPath, [emailScriptPath], {
      env: {
        SMTP_HOST: '',
        SMTP_PORT: '',
        SMTP_USER: '',
      },
    });

    let errOutput = '';
    child.stderr.on('data', (data) => {
      errOutput += data.toString();
    });

    child.on('close', (code) => {
      assert.strictEqual(code, 1);
      assert.ok(
        errOutput.includes('CRITICAL: Google Workspace SMTP is not configured correctly'),
        `Unexpected error output: ${errOutput}`
      );
      done();
    });
  });
});
