import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Resolved workspace root directory.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Pre-emptively load the environment variables from the centralized root .env
 * at ES module initialization time.
 * 
 * Why? ESM loads static imports before running any local file execution statements.
 * Importing this file first guarantees process.env is populated before subsequent
 * modules validate configuration parameters on boot.
 */
dotenv.config({ path: resolve(__dirname, '../../.env') });

/**
 * Fail-fast secret validation for production deployments.
 *
 * Why? If critical secrets are missing, the server must refuse to start rather
 * than silently falling back to insecure dev defaults. This prevents accidental
 * production deployments with weak JWT signing keys or unsigned Stripe webhooks.
 */
if (process.env.NODE_ENV === 'production') {
  const REQUIRED_SECRETS = [
    'JWT_SECRET',
    'ADMIN_JWT_SECRET',
  ];

  for (const key of REQUIRED_SECRETS) {
    if (!process.env[key]) {
      console.error(`🚨 FATAL: Missing required environment variable: ${key}. Server cannot start in production.`);
      process.exit(1);
    }
  }
}
