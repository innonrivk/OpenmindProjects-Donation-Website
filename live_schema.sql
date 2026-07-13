--
-- PostgreSQL database dump
--

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: PiggyBankType; Type: TYPE; Schema: public; Owner: omp_user
--

CREATE TYPE public."PiggyBankType" AS ENUM (
    'DONOR_SEED',
    'SHAREHOLDER_CAMPAIGN'
);


ALTER TYPE public."PiggyBankType" OWNER TO omp_user;

--
-- Name: ProjectStatus; Type: TYPE; Schema: public; Owner: omp_user
--

CREATE TYPE public."ProjectStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public."ProjectStatus" OWNER TO omp_user;

--
-- Name: SectionIdentifier; Type: TYPE; Schema: public; Owner: omp_user
--

CREATE TYPE public."SectionIdentifier" AS ENUM (
    'WELCOME',
    'ACTIVE_PROJECTS',
    'DONATION_BOXES',
    'DONATION_TIERS',
    'DONATION_ROADMAP',
    'TANGIBLE_IMPACT',
    'FOOTER'
);


ALTER TYPE public."SectionIdentifier" OWNER TO omp_user;

--
-- Name: TransactionStatus; Type: TYPE; Schema: public; Owner: omp_user
--

CREATE TYPE public."TransactionStatus" AS ENUM (
    'SUCCEEDED',
    'FAILED',
    'REFUNDED'
);


ALTER TYPE public."TransactionStatus" OWNER TO omp_user;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: omp_user
--

CREATE TYPE public."UserRole" AS ENUM (
    'DONOR',
    'ADMIN',
    'CONTENT_ADMIN',
    'OPERATIONS_ADMIN',
    'SUPER_ADMIN',
    'SYSADMIN'
);


ALTER TYPE public."UserRole" OWNER TO omp_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO omp_user;

--
-- Name: admin_role_assignments; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.admin_role_assignments (
    id integer NOT NULL,
    automation_trigger_id integer NOT NULL,
    role public."UserRole" NOT NULL
);


ALTER TABLE public.admin_role_assignments OWNER TO omp_user;

--
-- Name: admin_role_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.admin_role_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_role_assignments_id_seq OWNER TO omp_user;

--
-- Name: admin_role_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.admin_role_assignments_id_seq OWNED BY public.admin_role_assignments.id;


--
-- Name: allowed_admin_emails; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.allowed_admin_emails (
    id integer NOT NULL,
    email text NOT NULL,
    role public."UserRole" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.allowed_admin_emails OWNER TO omp_user;

--
-- Name: allowed_admin_emails_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.allowed_admin_emails_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.allowed_admin_emails_id_seq OWNER TO omp_user;

--
-- Name: allowed_admin_emails_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.allowed_admin_emails_id_seq OWNED BY public.allowed_admin_emails.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    actor_id text NOT NULL,
    target_user_id text,
    action text NOT NULL,
    old_value text,
    new_value text,
    ip_address text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO omp_user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO omp_user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: automation_triggers; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.automation_triggers (
    id integer NOT NULL,
    event_name text NOT NULL,
    tier_id integer,
    email_template_id integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.automation_triggers OWNER TO omp_user;

--
-- Name: automation_triggers_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.automation_triggers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.automation_triggers_id_seq OWNER TO omp_user;

--
-- Name: automation_triggers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.automation_triggers_id_seq OWNED BY public.automation_triggers.id;


--
-- Name: claimed_milestones; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.claimed_milestones (
    id integer NOT NULL,
    user_id text NOT NULL,
    milestone_id integer NOT NULL,
    claimed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.claimed_milestones OWNER TO omp_user;

--
-- Name: claimed_milestones_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.claimed_milestones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.claimed_milestones_id_seq OWNER TO omp_user;

--
-- Name: claimed_milestones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.claimed_milestones_id_seq OWNED BY public.claimed_milestones.id;


--
-- Name: dispatch_logs; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.dispatch_logs (
    id integer NOT NULL,
    email_template_id integer,
    transaction_id text,
    triggered_by text NOT NULL,
    recipient_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'QUEUED'::text NOT NULL,
    error_message text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.dispatch_logs OWNER TO omp_user;

--
-- Name: dispatch_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.dispatch_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dispatch_logs_id_seq OWNER TO omp_user;

--
-- Name: dispatch_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.dispatch_logs_id_seq OWNED BY public.dispatch_logs.id;


--
-- Name: dispatch_recipients; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.dispatch_recipients (
    id integer NOT NULL,
    dispatch_id integer NOT NULL,
    email text NOT NULL,
    status text DEFAULT 'QUEUED'::text NOT NULL,
    error_reason text
);


ALTER TABLE public.dispatch_recipients OWNER TO omp_user;

--
-- Name: dispatch_recipients_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.dispatch_recipients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dispatch_recipients_id_seq OWNER TO omp_user;

--
-- Name: dispatch_recipients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.dispatch_recipients_id_seq OWNED BY public.dispatch_recipients.id;


--
-- Name: donation_boxes; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.donation_boxes (
    id integer NOT NULL,
    title text NOT NULL,
    amount integer DEFAULT 0 NOT NULL,
    tier_id integer,
    tier_details text DEFAULT ''::text NOT NULL,
    button_text text DEFAULT 'Donate'::text NOT NULL,
    is_custom_amount boolean DEFAULT false NOT NULL,
    is_recurring boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    perks jsonb DEFAULT '[]'::jsonb NOT NULL
);


ALTER TABLE public.donation_boxes OWNER TO omp_user;

--
-- Name: donation_boxes_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.donation_boxes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.donation_boxes_id_seq OWNER TO omp_user;

--
-- Name: donation_boxes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.donation_boxes_id_seq OWNED BY public.donation_boxes.id;


--
-- Name: donation_milestones; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.donation_milestones (
    id integer NOT NULL,
    amount_usd integer NOT NULL,
    label text NOT NULL,
    description text NOT NULL,
    is_repeatable boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.donation_milestones OWNER TO omp_user;

--
-- Name: donation_milestones_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.donation_milestones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.donation_milestones_id_seq OWNER TO omp_user;

--
-- Name: donation_milestones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.donation_milestones_id_seq OWNED BY public.donation_milestones.id;


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.email_templates (
    id integer NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body_html text NOT NULL,
    pdf_config jsonb,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.email_templates OWNER TO omp_user;

--
-- Name: email_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.email_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_templates_id_seq OWNER TO omp_user;

--
-- Name: email_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.email_templates_id_seq OWNED BY public.email_templates.id;


--
-- Name: internal_notifications; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.internal_notifications (
    id integer NOT NULL,
    user_id text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.internal_notifications OWNER TO omp_user;

--
-- Name: internal_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.internal_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.internal_notifications_id_seq OWNER TO omp_user;

--
-- Name: internal_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.internal_notifications_id_seq OWNED BY public.internal_notifications.id;


--
-- Name: piggy_banks; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.piggy_banks (
    id integer NOT NULL,
    bank_type public."PiggyBankType" NOT NULL,
    project_id integer,
    balance integer DEFAULT 0 NOT NULL,
    period_month timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.piggy_banks OWNER TO omp_user;

--
-- Name: piggy_banks_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.piggy_banks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.piggy_banks_id_seq OWNER TO omp_user;

--
-- Name: piggy_banks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.piggy_banks_id_seq OWNED BY public.piggy_banks.id;


--
-- Name: projects_detail; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.projects_detail (
    id integer NOT NULL,
    project_name text NOT NULL,
    details text DEFAULT ''::text NOT NULL,
    status public."ProjectStatus" DEFAULT 'ACTIVE'::public."ProjectStatus" NOT NULL,
    image_url text,
    funding_goal integer DEFAULT 0 NOT NULL,
    funded_amount integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.projects_detail OWNER TO omp_user;

--
-- Name: projects_detail_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.projects_detail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.projects_detail_id_seq OWNER TO omp_user;

--
-- Name: projects_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.projects_detail_id_seq OWNED BY public.projects_detail.id;


--
-- Name: receipt_settings; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.receipt_settings (
    id integer NOT NULL,
    donation_type text DEFAULT 'GLOBAL'::text NOT NULL,
    email_subject_template text DEFAULT 'Thank you for your donation — Official OMP Receipt 🎉'::text NOT NULL,
    pdf_thank_you_message text DEFAULT 'We appreciate your generous support.'::text NOT NULL,
    pdf_footer_note text DEFAULT 'This PDF is your official donation receipt. Please retain for your records.'::text NOT NULL,
    pdf_signature_name text DEFAULT 'The OpenmindProjects Team'::text NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.receipt_settings OWNER TO omp_user;

--
-- Name: receipt_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.receipt_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.receipt_settings_id_seq OWNER TO omp_user;

--
-- Name: receipt_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.receipt_settings_id_seq OWNED BY public.receipt_settings.id;


--
-- Name: site_text; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.site_text (
    id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    section public."SectionIdentifier" NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.site_text OWNER TO omp_user;

--
-- Name: tiers; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.tiers (
    id integer NOT NULL,
    tier_level integer NOT NULL,
    name text NOT NULL,
    min_amount integer NOT NULL,
    max_amount integer,
    is_auto_applied_by_sum boolean DEFAULT false NOT NULL,
    perks jsonb DEFAULT '[]'::jsonb NOT NULL
);


ALTER TABLE public.tiers OWNER TO omp_user;

--
-- Name: tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tiers_id_seq OWNER TO omp_user;

--
-- Name: tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.tiers_id_seq OWNED BY public.tiers.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.transactions (
    id text NOT NULL,
    user_id text NOT NULL,
    stripe_payment_intent_id text,
    stripe_invoice_id text,
    amount integer NOT NULL,
    status public."TransactionStatus" DEFAULT 'SUCCEEDED'::public."TransactionStatus" NOT NULL,
    is_recurring boolean DEFAULT true NOT NULL,
    subject text,
    admin_note text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.transactions OWNER TO omp_user;

--
-- Name: user_otps; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.user_otps (
    id text NOT NULL,
    email text NOT NULL,
    otp text NOT NULL,
    purpose text NOT NULL,
    new_email text,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_otps OWNER TO omp_user;

--
-- Name: user_tiers; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.user_tiers (
    id integer NOT NULL,
    user_id text NOT NULL,
    tier_id integer NOT NULL,
    "assignedBy" text DEFAULT 'MANUAL'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_tiers OWNER TO omp_user;

--
-- Name: user_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.user_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_tiers_id_seq OWNER TO omp_user;

--
-- Name: user_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.user_tiers_id_seq OWNED BY public.user_tiers.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    password text,
    google_id text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    country text DEFAULT ''::text NOT NULL,
    role public."UserRole" DEFAULT 'DONOR'::public."UserRole" NOT NULL,
    token_version integer DEFAULT 0 NOT NULL,
    stripe_customer_id text,
    monthly_amount integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_protected boolean DEFAULT false NOT NULL,
    scheduled_amount integer,
    scheduled_amount_effective_date timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO omp_user;

--
-- Name: votes; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.votes (
    id integer NOT NULL,
    user_id text NOT NULL,
    project_id integer NOT NULL,
    piggy_bank_id integer NOT NULL,
    seed_count integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.votes OWNER TO omp_user;

--
-- Name: votes_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.votes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.votes_id_seq OWNER TO omp_user;

--
-- Name: votes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.votes_id_seq OWNED BY public.votes.id;


--
-- Name: website_content; Type: TABLE; Schema: public; Owner: omp_user
--

CREATE TABLE public.website_content (
    id integer NOT NULL,
    head text DEFAULT ''::text NOT NULL,
    subtitle text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.website_content OWNER TO omp_user;

--
-- Name: website_content_id_seq; Type: SEQUENCE; Schema: public; Owner: omp_user
--

CREATE SEQUENCE public.website_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.website_content_id_seq OWNER TO omp_user;

--
-- Name: website_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: omp_user
--

ALTER SEQUENCE public.website_content_id_seq OWNED BY public.website_content.id;


--
-- Name: admin_role_assignments id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.admin_role_assignments ALTER COLUMN id SET DEFAULT nextval('public.admin_role_assignments_id_seq'::regclass);


--
-- Name: allowed_admin_emails id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.allowed_admin_emails ALTER COLUMN id SET DEFAULT nextval('public.allowed_admin_emails_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: automation_triggers id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.automation_triggers ALTER COLUMN id SET DEFAULT nextval('public.automation_triggers_id_seq'::regclass);


--
-- Name: claimed_milestones id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.claimed_milestones ALTER COLUMN id SET DEFAULT nextval('public.claimed_milestones_id_seq'::regclass);


--
-- Name: dispatch_logs id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.dispatch_logs ALTER COLUMN id SET DEFAULT nextval('public.dispatch_logs_id_seq'::regclass);


--
-- Name: dispatch_recipients id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.dispatch_recipients ALTER COLUMN id SET DEFAULT nextval('public.dispatch_recipients_id_seq'::regclass);


--
-- Name: donation_boxes id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.donation_boxes ALTER COLUMN id SET DEFAULT nextval('public.donation_boxes_id_seq'::regclass);


--
-- Name: donation_milestones id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.donation_milestones ALTER COLUMN id SET DEFAULT nextval('public.donation_milestones_id_seq'::regclass);


--
-- Name: email_templates id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.email_templates ALTER COLUMN id SET DEFAULT nextval('public.email_templates_id_seq'::regclass);


--
-- Name: internal_notifications id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.internal_notifications ALTER COLUMN id SET DEFAULT nextval('public.internal_notifications_id_seq'::regclass);


--
-- Name: piggy_banks id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.piggy_banks ALTER COLUMN id SET DEFAULT nextval('public.piggy_banks_id_seq'::regclass);


--
-- Name: projects_detail id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.projects_detail ALTER COLUMN id SET DEFAULT nextval('public.projects_detail_id_seq'::regclass);


--
-- Name: receipt_settings id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.receipt_settings ALTER COLUMN id SET DEFAULT nextval('public.receipt_settings_id_seq'::regclass);


--
-- Name: tiers id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.tiers ALTER COLUMN id SET DEFAULT nextval('public.tiers_id_seq'::regclass);


--
-- Name: user_tiers id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.user_tiers ALTER COLUMN id SET DEFAULT nextval('public.user_tiers_id_seq'::regclass);


--
-- Name: votes id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.votes ALTER COLUMN id SET DEFAULT nextval('public.votes_id_seq'::regclass);


--
-- Name: website_content id; Type: DEFAULT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.website_content ALTER COLUMN id SET DEFAULT nextval('public.website_content_id_seq'::regclass);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: admin_role_assignments admin_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.admin_role_assignments
    ADD CONSTRAINT admin_role_assignments_pkey PRIMARY KEY (id);


--
-- Name: allowed_admin_emails allowed_admin_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.allowed_admin_emails
    ADD CONSTRAINT allowed_admin_emails_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_triggers automation_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.automation_triggers
    ADD CONSTRAINT automation_triggers_pkey PRIMARY KEY (id);


--
-- Name: claimed_milestones claimed_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.claimed_milestones
    ADD CONSTRAINT claimed_milestones_pkey PRIMARY KEY (id);


--
-- Name: dispatch_logs dispatch_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.dispatch_logs
    ADD CONSTRAINT dispatch_logs_pkey PRIMARY KEY (id);


--
-- Name: dispatch_recipients dispatch_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.dispatch_recipients
    ADD CONSTRAINT dispatch_recipients_pkey PRIMARY KEY (id);


--
-- Name: donation_boxes donation_boxes_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.donation_boxes
    ADD CONSTRAINT donation_boxes_pkey PRIMARY KEY (id);


--
-- Name: donation_milestones donation_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.donation_milestones
    ADD CONSTRAINT donation_milestones_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: internal_notifications internal_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.internal_notifications
    ADD CONSTRAINT internal_notifications_pkey PRIMARY KEY (id);


--
-- Name: piggy_banks piggy_banks_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.piggy_banks
    ADD CONSTRAINT piggy_banks_pkey PRIMARY KEY (id);


--
-- Name: projects_detail projects_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.projects_detail
    ADD CONSTRAINT projects_detail_pkey PRIMARY KEY (id);


--
-- Name: receipt_settings receipt_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.receipt_settings
    ADD CONSTRAINT receipt_settings_pkey PRIMARY KEY (id);


--
-- Name: site_text site_text_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.site_text
    ADD CONSTRAINT site_text_pkey PRIMARY KEY (id);


--
-- Name: tiers tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.tiers
    ADD CONSTRAINT tiers_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_otps user_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.user_otps
    ADD CONSTRAINT user_otps_pkey PRIMARY KEY (id);


--
-- Name: user_tiers user_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.user_tiers
    ADD CONSTRAINT user_tiers_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (id);


--
-- Name: website_content website_content_pkey; Type: CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.website_content
    ADD CONSTRAINT website_content_pkey PRIMARY KEY (id);


--
-- Name: admin_role_assignments_automation_trigger_id_role_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX admin_role_assignments_automation_trigger_id_role_key ON public.admin_role_assignments USING btree (automation_trigger_id, role);


--
-- Name: allowed_admin_emails_email_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX allowed_admin_emails_email_key ON public.allowed_admin_emails USING btree (email);


--
-- Name: audit_logs_actor_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs USING btree (actor_id);


--
-- Name: audit_logs_target_user_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX audit_logs_target_user_id_idx ON public.audit_logs USING btree (target_user_id);


--
-- Name: automation_triggers_event_name_tier_id_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX automation_triggers_event_name_tier_id_key ON public.automation_triggers USING btree (event_name, tier_id);


--
-- Name: claimed_milestones_user_id_milestone_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX claimed_milestones_user_id_milestone_id_idx ON public.claimed_milestones USING btree (user_id, milestone_id);


--
-- Name: dispatch_logs_email_template_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX dispatch_logs_email_template_id_idx ON public.dispatch_logs USING btree (email_template_id);


--
-- Name: dispatch_logs_transaction_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX dispatch_logs_transaction_id_idx ON public.dispatch_logs USING btree (transaction_id);


--
-- Name: dispatch_recipients_dispatch_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX dispatch_recipients_dispatch_id_idx ON public.dispatch_recipients USING btree (dispatch_id);


--
-- Name: donation_boxes_tier_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX donation_boxes_tier_id_idx ON public.donation_boxes USING btree (tier_id);


--
-- Name: email_templates_name_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX email_templates_name_key ON public.email_templates USING btree (name);


--
-- Name: internal_notifications_user_id_is_read_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX internal_notifications_user_id_is_read_idx ON public.internal_notifications USING btree (user_id, is_read);


--
-- Name: piggy_banks_project_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX piggy_banks_project_id_idx ON public.piggy_banks USING btree (project_id);


--
-- Name: receipt_settings_donation_type_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX receipt_settings_donation_type_key ON public.receipt_settings USING btree (donation_type);


--
-- Name: site_text_key_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX site_text_key_key ON public.site_text USING btree (key);


--
-- Name: site_text_section_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX site_text_section_idx ON public.site_text USING btree (section);


--
-- Name: transactions_stripe_invoice_id_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX transactions_stripe_invoice_id_key ON public.transactions USING btree (stripe_invoice_id);


--
-- Name: transactions_stripe_payment_intent_id_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX transactions_stripe_payment_intent_id_key ON public.transactions USING btree (stripe_payment_intent_id);


--
-- Name: transactions_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX transactions_user_id_created_at_idx ON public.transactions USING btree (user_id, created_at DESC);


--
-- Name: user_tiers_tier_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX user_tiers_tier_id_idx ON public.user_tiers USING btree (tier_id);


--
-- Name: user_tiers_user_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX user_tiers_user_id_idx ON public.user_tiers USING btree (user_id);


--
-- Name: user_tiers_user_id_tier_id_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX user_tiers_user_id_tier_id_key ON public.user_tiers USING btree (user_id, tier_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_google_id_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX users_google_id_key ON public.users USING btree (google_id);


--
-- Name: users_stripe_customer_id_key; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE UNIQUE INDEX users_stripe_customer_id_key ON public.users USING btree (stripe_customer_id);


--
-- Name: votes_piggy_bank_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX votes_piggy_bank_id_idx ON public.votes USING btree (piggy_bank_id);


--
-- Name: votes_project_id_idx; Type: INDEX; Schema: public; Owner: omp_user
--

CREATE INDEX votes_project_id_idx ON public.votes USING btree (project_id);


--
-- Name: admin_role_assignments admin_role_assignments_automation_trigger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.admin_role_assignments
    ADD CONSTRAINT admin_role_assignments_automation_trigger_id_fkey FOREIGN KEY (automation_trigger_id) REFERENCES public.automation_triggers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: automation_triggers automation_triggers_email_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.automation_triggers
    ADD CONSTRAINT automation_triggers_email_template_id_fkey FOREIGN KEY (email_template_id) REFERENCES public.email_templates(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: claimed_milestones claimed_milestones_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.claimed_milestones
    ADD CONSTRAINT claimed_milestones_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.donation_milestones(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: claimed_milestones claimed_milestones_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.claimed_milestones
    ADD CONSTRAINT claimed_milestones_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: dispatch_logs dispatch_logs_email_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.dispatch_logs
    ADD CONSTRAINT dispatch_logs_email_template_id_fkey FOREIGN KEY (email_template_id) REFERENCES public.email_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: dispatch_logs dispatch_logs_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.dispatch_logs
    ADD CONSTRAINT dispatch_logs_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: dispatch_recipients dispatch_recipients_dispatch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.dispatch_recipients
    ADD CONSTRAINT dispatch_recipients_dispatch_id_fkey FOREIGN KEY (dispatch_id) REFERENCES public.dispatch_logs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: donation_boxes donation_boxes_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.donation_boxes
    ADD CONSTRAINT donation_boxes_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.tiers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: internal_notifications internal_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.internal_notifications
    ADD CONSTRAINT internal_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: piggy_banks piggy_banks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.piggy_banks
    ADD CONSTRAINT piggy_banks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects_detail(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_tiers user_tiers_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.user_tiers
    ADD CONSTRAINT user_tiers_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.tiers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_tiers user_tiers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.user_tiers
    ADD CONSTRAINT user_tiers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: votes votes_piggy_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_piggy_bank_id_fkey FOREIGN KEY (piggy_bank_id) REFERENCES public.piggy_banks(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: votes votes_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects_detail(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: votes votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: omp_user
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--
