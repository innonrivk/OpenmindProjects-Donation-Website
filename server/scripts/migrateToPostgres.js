import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlitePath = path.resolve(__dirname, '../prisma/dev.db');

async function main() {
  console.log('🏁 Starting SQLite to PostgreSQL ETL Migration...');
  console.log(`Open SQLite DB from: ${sqlitePath}`);
  
  const sqlite = new Database(sqlitePath, { readonly: true });
  const pg = new PrismaClient();

  try {
    // 1. Users
    console.log('Migrating Users...');
    const users = sqlite.prepare('SELECT * FROM users').all();
    for (const u of users) {
      await pg.user.create({
        data: {
          id: u.id,
          email: u.email,
          password: u.password,
          googleId: u.google_id,
          firstName: u.first_name,
          lastName: u.last_name,
          country: u.country,
          role: u.role,
          tokenVersion: u.token_version,
          stripeCustomerId: u.stripe_customer_id,
          monthlyAmount: u.monthly_amount,
          isActive: u.is_active === 1,
          isProtected: u.is_protected === 1,
          scheduledAmount: u.scheduled_amount,
          scheduledAmountEffectiveDate: u.scheduled_amount_effective_date ? new Date(u.scheduled_amount_effective_date) : null,
          createdAt: new Date(u.created_at),
          updatedAt: new Date(u.updated_at),
        },
      });
    }

    // 2. Tiers
    console.log('Migrating Tiers...');
    const tiers = sqlite.prepare('SELECT * FROM tiers').all();
    for (const t of tiers) {
      await pg.tier.create({
        data: {
          id: t.id,
          tierLevel: t.tier_level,
          name: t.name,
          minAmount: t.min_amount,
          maxAmount: t.max_amount,
          isAutoAppliedBySum: t.is_auto_applied_by_sum === 1,
          perks: typeof t.perks === 'string' ? JSON.parse(t.perks) : t.perks,
        },
      });
    }

    // 3. DonationBoxes
    console.log('Migrating DonationBoxes...');
    const boxes = sqlite.prepare('SELECT * FROM donation_boxes').all();
    for (const b of boxes) {
      await pg.donationBox.create({
        data: {
          id: b.id,
          title: b.title,
          amount: b.amount,
          tierId: b.tier_id,
          tierDetails: b.tier_details,
          buttonText: b.button_text,
          isCustomAmount: b.is_custom_amount === 1,
          isRecurring: b.is_recurring === 1,
          isActive: b.is_active === 1,
          displayOrder: b.display_order,
          perks: typeof b.perks === 'string' ? JSON.parse(b.perks) : b.perks,
        },
      });
    }

    // 4. Transactions
    console.log('Migrating Transactions...');
    const txs = sqlite.prepare('SELECT * FROM transactions').all();
    for (const t of txs) {
      await pg.transaction.create({
        data: {
          id: t.id,
          userId: t.user_id,
          stripePaymentIntentId: t.stripe_payment_intent_id,
          stripeInvoiceId: t.stripe_invoice_id,
          amount: t.amount,
          status: t.status,
          isRecurring: t.is_recurring === 1,
          subject: t.subject,
          adminNote: t.admin_note,
          createdAt: new Date(t.created_at),
        },
      });
    }

    // 5. UserTiers
    console.log('Migrating UserTiers...');
    const userTiers = sqlite.prepare('SELECT * FROM user_tiers').all();
    for (const ut of userTiers) {
      await pg.userTier.create({
        data: {
          id: ut.id,
          userId: ut.user_id,
          tierId: ut.tier_id,
          assignedBy: ut.assignedBy,
          createdAt: new Date(ut.created_at),
        },
      });
    }

    // 6. ProjectDetails
    console.log('Migrating ProjectDetails...');
    const projects = sqlite.prepare('SELECT * FROM projects_detail').all();
    for (const p of projects) {
      await pg.projectDetail.create({
        data: {
          id: p.id,
          projectName: p.project_name,
          details: p.details,
          status: p.status,
          imageUrl: p.image_url,
          fundingGoal: p.funding_goal,
          fundedAmount: p.funded_amount,
        },
      });
    }

    // 7. PiggyBanks
    console.log('Migrating PiggyBanks...');
    const banks = sqlite.prepare('SELECT * FROM piggy_banks').all();
    for (const b of banks) {
      await pg.piggyBank.create({
        data: {
          id: b.id,
          bankType: b.bank_type,
          projectId: b.project_id,
          balance: b.balance,
          periodMonth: new Date(b.period_month),
        },
      });
    }

    // 8. Votes
    console.log('Migrating Votes...');
    const votes = sqlite.prepare('SELECT * FROM votes').all();
    for (const v of votes) {
      await pg.vote.create({
        data: {
          id: v.id,
          userId: v.user_id,
          projectId: v.project_id,
          piggyBankId: v.piggy_bank_id,
          seedCount: v.seed_count,
          createdAt: new Date(v.created_at),
        },
      });
    }

    // 9. DonationMilestones
    console.log('Migrating DonationMilestones...');
    const milestones = sqlite.prepare('SELECT * FROM donation_milestones').all();
    for (const m of milestones) {
      await pg.donationMilestone.create({
        data: {
          id: m.id,
          amountUsd: m.amount_usd,
          label: m.label,
          description: m.description,
          isRepeatable: m.is_repeatable === 1,
          displayOrder: m.display_order,
        },
      });
    }

    // 10. ClaimedMilestones
    console.log('Migrating ClaimedMilestones...');
    const claimed = sqlite.prepare('SELECT * FROM claimed_milestones').all();
    for (const c of claimed) {
      await pg.claimedMilestone.create({
        data: {
          id: c.id,
          userId: c.user_id,
          milestoneId: c.milestone_id,
          claimedAt: new Date(c.claimed_at),
        },
      });
    }

    // 11. WebsiteContent
    console.log('Migrating WebsiteContent...');
    const content = sqlite.prepare('SELECT * FROM website_content').all();
    for (const c of content) {
      await pg.websiteContent.create({
        data: {
          id: c.id,
          head: c.head,
          subtitle: c.subtitle,
          body: c.body,
          version: c.version,
          updatedAt: new Date(c.updated_at),
        },
      });
    }

    // 12. SiteText
    console.log('Migrating SiteText...');
    const texts = sqlite.prepare('SELECT * FROM site_text').all();
    for (const t of texts) {
      await pg.siteText.create({
        data: {
          id: t.id,
          key: t.key,
          value: t.value,
          section: t.section,
          updatedAt: new Date(t.updated_at),
        },
      });
    }

    // 13. ReceiptSettings
    console.log('Migrating ReceiptSettings...');
    const receipts = sqlite.prepare('SELECT * FROM receipt_settings').all();
    for (const r of receipts) {
      await pg.receiptSettings.create({
        data: {
          id: r.id,
          donationType: r.donation_type,
          emailSubjectTemplate: r.email_subject_template,
          pdfThankYouMessage: r.pdf_thank_you_message,
          pdfFooterNote: r.pdf_footer_note,
          pdfSignatureName: r.pdf_signature_name,
          updatedAt: new Date(r.updated_at),
        },
      });
    }

    // 14. UserOtp
    console.log('Migrating UserOtps...');
    const otps = sqlite.prepare('SELECT * FROM user_otps').all();
    for (const o of otps) {
      await pg.userOtp.create({
        data: {
          id: o.id,
          email: o.email,
          otp: o.otp,
          purpose: o.purpose,
          newEmail: o.new_email,
          attempts: o.attempts,
          expiresAt: new Date(o.expires_at),
          createdAt: new Date(o.created_at),
        },
      });
    }

    // 15. AuditLog
    console.log('Migrating AuditLogs...');
    const logs = sqlite.prepare('SELECT * FROM audit_logs').all();
    for (const l of logs) {
      await pg.auditLog.create({
        data: {
          id: l.id,
          actorId: l.actor_id,
          targetUserId: l.target_user_id,
          action: l.action,
          oldValue: l.old_value,
          newValue: l.new_value,
          ipAddress: l.ip_address,
          createdAt: new Date(l.created_at),
        },
      });
    }

    // 16. AllowedAdminEmail
    console.log('Migrating AllowedAdminEmails...');
    const allowed = sqlite.prepare('SELECT * FROM allowed_admin_emails').all();
    for (const a of allowed) {
      await pg.allowedAdminEmail.create({
        data: {
          id: a.id,
          email: a.email,
          role: a.role,
          createdAt: new Date(a.created_at),
          updatedAt: new Date(a.updated_at),
        },
      });
    }

    // 17. EmailTemplate
    console.log('Migrating EmailTemplates...');
    const templates = sqlite.prepare('SELECT * FROM email_templates').all();
    for (const t of templates) {
      await pg.emailTemplate.create({
        data: {
          id: t.id,
          name: t.name,
          subject: t.subject,
          bodyHtml: t.body_html,
          pdfConfig: t.pdf_config ? (typeof t.pdf_config === 'string' ? JSON.parse(t.pdf_config) : t.pdf_config) : null,
          isArchived: t.is_archived === 1,
          createdAt: new Date(t.created_at),
          updatedAt: new Date(t.updated_at),
        },
      });
    }

    // 18. AutomationTrigger
    console.log('Migrating AutomationTriggers...');
    const triggers = sqlite.prepare('SELECT * FROM automation_triggers').all();
    for (const t of triggers) {
      await pg.automationTrigger.create({
        data: {
          id: t.id,
          eventName: t.event_name,
          tierId: t.tier_id,
          emailTemplateId: t.email_template_id,
          isActive: t.is_active === 1,
          createdAt: new Date(t.created_at),
        },
      });
    }

    // 19. AdminRoleAssignment
    console.log('Migrating AdminRoleAssignments...');
    const assignments = sqlite.prepare('SELECT * FROM admin_role_assignments').all();
    for (const a of assignments) {
      await pg.adminRoleAssignment.create({
        data: {
          id: a.id,
          automationTriggerId: a.automation_trigger_id,
          role: a.role,
        },
      });
    }

    // 20. DispatchLog
    console.log('Migrating DispatchLogs...');
    const dlogs = sqlite.prepare('SELECT * FROM dispatch_logs').all();
    for (const d of dlogs) {
      await pg.dispatchLog.create({
        data: {
          id: d.id,
          emailTemplateId: d.email_template_id,
          transactionId: d.transaction_id,
          triggeredBy: d.triggered_by,
          recipientCount: d.recipient_count,
          status: d.status,
          errorMessage: d.error_message,
          createdAt: new Date(d.created_at),
        },
      });
    }

    // 21. DispatchRecipient
    console.log('Migrating DispatchRecipients...');
    const drecips = sqlite.prepare('SELECT * FROM dispatch_recipients').all();
    for (const dr of drecips) {
      await pg.dispatchRecipient.create({
        data: {
          id: dr.id,
          dispatchId: dr.dispatch_id,
          email: dr.email,
          status: dr.status,
          errorReason: dr.error_reason,
        },
      });
    }

    // 22. InternalNotification
    console.log('Migrating InternalNotifications...');
    const inotifs = sqlite.prepare('SELECT * FROM internal_notifications').all();
    for (const i of inotifs) {
      await pg.internalNotification.create({
        data: {
          id: i.id,
          userId: i.user_id,
          title: i.title,
          message: i.message,
          isRead: i.is_read === 1,
          createdAt: new Date(i.created_at),
        },
      });
    }

    // 23. Reset all database sequences in PostgreSQL
    console.log('Resetting PostgreSQL autoincrement sequences...');
    const autoIncrementTables = [
      'receipt_settings',
      'tiers',
      'donation_boxes',
      'website_content',
      'projects_detail',
      'piggy_banks',
      'votes',
      'donation_milestones',
      'claimed_milestones',
      'audit_logs',
      'allowed_admin_emails',
      'user_tiers',
      'email_templates',
      'automation_triggers',
      'admin_role_assignments',
      'dispatch_logs',
      'dispatch_recipients',
      'internal_notifications',
    ];

    for (const table of autoIncrementTables) {
      try {
        await pg.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), coalesce(max(id), 1)) FROM "${table}"`
        );
      } catch (err) {
        console.warn(`\u26a0\ufe0f Warning: Failed to reset sequence for table "${table}":`, err.message);
      }
    }

    console.log('\ud83c\udf89 SQLite to PostgreSQL ETL Migration Completed Successfully!');
  } catch (error) {
    console.error('\u274c Data migration failed:', error);
    process.exit(1);
  } finally {
    sqlite.close();
    await pg.$disconnect();
  }
}

main();
