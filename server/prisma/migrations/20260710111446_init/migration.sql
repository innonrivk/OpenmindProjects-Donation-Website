-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DONOR', 'ADMIN', 'CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PiggyBankType" AS ENUM ('DONOR_SEED', 'SHAREHOLDER_CAMPAIGN');

-- CreateEnum
CREATE TYPE "SectionIdentifier" AS ENUM ('WELCOME', 'ACTIVE_PROJECTS', 'DONATION_BOXES', 'DONATION_TIERS', 'DONATION_ROADMAP', 'TANGIBLE_IMPACT', 'FOOTER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "google_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT '',
    "role" "UserRole" NOT NULL DEFAULT 'DONOR',
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "stripe_customer_id" TEXT,
    "monthly_amount" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_protected" BOOLEAN NOT NULL DEFAULT false,
    "scheduled_amount" INTEGER,
    "scheduled_amount_effective_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_payment_intent_id" TEXT,
    "stripe_invoice_id" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "is_recurring" BOOLEAN NOT NULL DEFAULT true,
    "subject" TEXT,
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_settings" (
    "id" SERIAL NOT NULL,
    "donation_type" TEXT NOT NULL DEFAULT 'GLOBAL',
    "email_subject_template" TEXT NOT NULL DEFAULT 'Thank you for your donation — Official OMP Receipt 🎉',
    "pdf_thank_you_message" TEXT NOT NULL DEFAULT 'We appreciate your generous support.',
    "pdf_footer_note" TEXT NOT NULL DEFAULT 'This PDF is your official donation receipt. Please retain for your records.',
    "pdf_signature_name" TEXT NOT NULL DEFAULT 'The OpenmindProjects Team',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiers" (
    "id" SERIAL NOT NULL,
    "tier_level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "min_amount" INTEGER NOT NULL,
    "max_amount" INTEGER,
    "is_auto_applied_by_sum" BOOLEAN NOT NULL DEFAULT false,
    "perks" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_boxes" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "tier_id" INTEGER,
    "tier_details" TEXT NOT NULL DEFAULT '',
    "button_text" TEXT NOT NULL DEFAULT 'Donate',
    "is_custom_amount" BOOLEAN NOT NULL DEFAULT false,
    "is_recurring" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "perks" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "donation_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_content" (
    "id" SERIAL NOT NULL,
    "head" TEXT NOT NULL DEFAULT '',
    "subtitle" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects_detail" (
    "id" SERIAL NOT NULL,
    "project_name" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "image_url" TEXT,
    "funding_goal" INTEGER NOT NULL DEFAULT 0,
    "funded_amount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "projects_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "piggy_banks" (
    "id" SERIAL NOT NULL,
    "bank_type" "PiggyBankType" NOT NULL,
    "project_id" INTEGER,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "period_month" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "piggy_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,
    "piggy_bank_id" INTEGER NOT NULL,
    "seed_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_milestones" (
    "id" SERIAL NOT NULL,
    "amount_usd" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_repeatable" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "donation_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claimed_milestones" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "milestone_id" INTEGER NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claimed_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "new_email" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_text" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "section" "SectionIdentifier" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_text_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actor_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "action" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowed_admin_emails" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowed_admin_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tiers" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "tier_id" INTEGER NOT NULL,
    "assignedBy" TEXT NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "pdf_config" JSONB,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_triggers" (
    "id" SERIAL NOT NULL,
    "event_name" TEXT NOT NULL,
    "tier_id" INTEGER,
    "email_template_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_role_assignments" (
    "id" SERIAL NOT NULL,
    "automation_trigger_id" INTEGER NOT NULL,
    "role" "UserRole" NOT NULL,

    CONSTRAINT "admin_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_logs" (
    "id" SERIAL NOT NULL,
    "email_template_id" INTEGER,
    "transaction_id" TEXT,
    "triggered_by" TEXT NOT NULL,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_recipients" (
    "id" SERIAL NOT NULL,
    "dispatch_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error_reason" TEXT,

    CONSTRAINT "dispatch_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_notifications" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_stripe_payment_intent_id_key" ON "transactions"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_stripe_invoice_id_key" ON "transactions"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "receipt_settings_donation_type_key" ON "receipt_settings"("donation_type");

-- CreateIndex
CREATE INDEX "donation_boxes_tier_id_idx" ON "donation_boxes"("tier_id");

-- CreateIndex
CREATE INDEX "piggy_banks_project_id_idx" ON "piggy_banks"("project_id");

-- CreateIndex
CREATE INDEX "votes_project_id_idx" ON "votes"("project_id");

-- CreateIndex
CREATE INDEX "votes_piggy_bank_id_idx" ON "votes"("piggy_bank_id");

-- CreateIndex
CREATE INDEX "claimed_milestones_user_id_milestone_id_idx" ON "claimed_milestones"("user_id", "milestone_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_text_key_key" ON "site_text"("key");

-- CreateIndex
CREATE INDEX "site_text_section_idx" ON "site_text"("section");

-- CreateIndex
CREATE INDEX "audit_logs_target_user_id_idx" ON "audit_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "allowed_admin_emails_email_key" ON "allowed_admin_emails"("email");

-- CreateIndex
CREATE INDEX "user_tiers_user_id_idx" ON "user_tiers"("user_id");

-- CreateIndex
CREATE INDEX "user_tiers_tier_id_idx" ON "user_tiers"("tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_tiers_user_id_tier_id_key" ON "user_tiers"("user_id", "tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_name_key" ON "email_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "automation_triggers_event_name_tier_id_key" ON "automation_triggers"("event_name", "tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_role_assignments_automation_trigger_id_role_key" ON "admin_role_assignments"("automation_trigger_id", "role");

-- CreateIndex
CREATE INDEX "dispatch_logs_email_template_id_idx" ON "dispatch_logs"("email_template_id");

-- CreateIndex
CREATE INDEX "dispatch_logs_transaction_id_idx" ON "dispatch_logs"("transaction_id");

-- CreateIndex
CREATE INDEX "dispatch_recipients_dispatch_id_idx" ON "dispatch_recipients"("dispatch_id");

-- CreateIndex
CREATE INDEX "internal_notifications_user_id_is_read_idx" ON "internal_notifications"("user_id", "is_read");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_boxes" ADD CONSTRAINT "donation_boxes_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piggy_banks" ADD CONSTRAINT "piggy_banks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects_detail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects_detail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_piggy_bank_id_fkey" FOREIGN KEY ("piggy_bank_id") REFERENCES "piggy_banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claimed_milestones" ADD CONSTRAINT "claimed_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claimed_milestones" ADD CONSTRAINT "claimed_milestones_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "donation_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tiers" ADD CONSTRAINT "user_tiers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tiers" ADD CONSTRAINT "user_tiers_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_email_template_id_fkey" FOREIGN KEY ("email_template_id") REFERENCES "email_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_assignments" ADD CONSTRAINT "admin_role_assignments_automation_trigger_id_fkey" FOREIGN KEY ("automation_trigger_id") REFERENCES "automation_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_logs" ADD CONSTRAINT "dispatch_logs_email_template_id_fkey" FOREIGN KEY ("email_template_id") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_logs" ADD CONSTRAINT "dispatch_logs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_recipients" ADD CONSTRAINT "dispatch_recipients_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatch_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notifications" ADD CONSTRAINT "internal_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
