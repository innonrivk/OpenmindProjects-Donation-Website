import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlitePath = path.resolve(__dirname, '../prisma/dev.db');

async function main() {
  console.log('🔍 Starting SQLite to PostgreSQL Row Count Verification...');
  
  const sqlite = new Database(sqlitePath, { readonly: true });
  const pg = new PrismaClient();

  const tables = [
    { sqlite: 'users', pgModel: 'user' },
    { sqlite: 'tiers', pgModel: 'tier' },
    { sqlite: 'donation_boxes', pgModel: 'donationBox' },
    { sqlite: 'transactions', pgModel: 'transaction' },
    { sqlite: 'user_tiers', pgModel: 'userTier' },
    { sqlite: 'projects_detail', pgModel: 'projectDetail' },
    { sqlite: 'piggy_banks', pgModel: 'piggyBank' },
    { sqlite: 'votes', pgModel: 'vote' },
    { sqlite: 'donation_milestones', pgModel: 'donationMilestone' },
    { sqlite: 'claimed_milestones', pgModel: 'claimedMilestone' },
    { sqlite: 'website_content', pgModel: 'websiteContent' },
    { sqlite: 'site_text', pgModel: 'siteText' },
    { sqlite: 'receipt_settings', pgModel: 'receiptSettings' },
    { sqlite: 'user_otps', pgModel: 'userOtp' },
    { sqlite: 'audit_logs', pgModel: 'auditLog' },
    { sqlite: 'allowed_admin_emails', pgModel: 'allowedAdminEmail' },
    { sqlite: 'email_templates', pgModel: 'emailTemplate' },
    { sqlite: 'automation_triggers', pgModel: 'automationTrigger' },
    { sqlite: 'admin_role_assignments', pgModel: 'adminRoleAssignment' },
    { sqlite: 'dispatch_logs', pgModel: 'dispatchLog' },
    { sqlite: 'dispatch_recipients', pgModel: 'dispatchRecipient' },
    { sqlite: 'internal_notifications', pgModel: 'internalNotification' },
  ];

  let hasMismatch = false;

  try {
    for (const t of tables) {
      const sqliteCount = sqlite.prepare(`SELECT count(*) as count FROM "${t.sqlite}"`).get().count;
      const pgCount = await pg[t.pgModel].count();
      
      const status = sqliteCount === pgCount ? '✅ MATCH' : '❌ MISMATCH';
      console.log(`Table "${t.sqlite}": SQLite count = ${sqliteCount} | PostgreSQL count = ${pgCount} | ${status}`);
      
      if (sqliteCount !== pgCount) {
        hasMismatch = true;
      }
    }

    if (hasMismatch) {
      console.error('🚨 Validation failed: One or more tables have row count mismatches!');
      process.exit(1);
    } else {
      console.log('🎉 Validation successful: All table row counts match perfectly!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Verification script failed:', error);
    process.exit(1);
  } finally {
    sqlite.close();
    await pg.$disconnect();
  }
}

main();
