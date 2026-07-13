# Migration Plan: SQLite → PostgreSQL

## Overview

This plan details the complete conversion of the OpenmindProjects donation platform from SQLite (`file:./dev.db`) to PostgreSQL, including Docker infrastructure, raw SQL rewrites, concurrency improvements, data migration, and test updates.

---

## Design Decisions Summary

| Decision | Choice |
|---|---|
| **PostgreSQL Hosting** | Self-hosted in Docker (`docker-compose.yml`) |
| **Data Migration** | Migrate existing `dev.db` data via ETL script |
| **Migration Approach** | Big-bang switch (one-time, no dual-database) |
| **Queue Concurrency** | Unlock parallel processing (remove sequential SQLite workaround) |
| **Content Cache** | Remove in-memory cache (PostgreSQL handles concurrent reads) |
| **Schema Migrations** | Switch to `prisma migrate dev` (versioned migration files) |
| **Connection Pooling** | PgBouncer in Docker Compose stack |

---

## Impact Analysis

### Codebase Audit Results

I audited the entire codebase and identified **every** SQLite-specific pattern that needs conversion:

| Category | Files Affected | Details |
|---|---|---|
| **Prisma Schema** | 1 file | `provider = "sqlite"` → `"postgresql"` |
| **Raw SQL (strftime)** | 1 file (3 queries) | [adminAnalyticsController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/admin/adminAnalyticsController.js) — lines 96, 138, 187 |
| **Connection Config** | 1 file | [prisma.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/lib/prisma.js) — `busy_timeout`, `socket_timeout`, `connection_limit` |
| **Sequential Queue** | 1 file | [communicationQueue.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/workers/communicationQueue.js) — sequential fallback |
| **In-Memory Cache** | 1 file | [contentController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/public/contentController.js) — SQLite read workaround |
| **Docker Compose** | 1 file | [docker-compose.yml](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/docker-compose.yml) — SQLite volume → PostgreSQL service |
| **Dockerfile.server** | 1 file | [Dockerfile.server](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/Dockerfile.server) — remove SQLite native deps, add pg client |
| **Environment Config** | 2 files | `.env`, `.env.example` — `DATABASE_URL` format change |
| **Test Runner** | 1 file | [run.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/tests/run.js) — `DATABASE_URL` for test DB |
| **SQLite Comments** | ~8 files | Comment references to "SQLite" that become outdated |

---

## Phase 1: Docker Infrastructure

### Add PostgreSQL + PgBouncer to Docker Compose

#### [MODIFY] [docker-compose.yml](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/docker-compose.yml)

**Remove**: `sqlite_data` volume, `DATABASE_URL: file:/data/dev.db`

**Add** three new services:

```yaml
services:
  # ── PostgreSQL Database ───────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: omp-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: omp_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-omp_dev_password}
      POSTGRES_DB: omp_database
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"   # Expose for local dev tools (pgAdmin, DBeaver)
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U omp_user -d omp_database"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - omp-net

  # ── PgBouncer Connection Pooler ───────────────────────────────────────────
  pgbouncer:
    image: edoburu/pgbouncer:latest
    container_name: omp-pgbouncer
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://omp_user:${POSTGRES_PASSWORD:-omp_dev_password}@postgres:5432/omp_database
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 200
      DEFAULT_POOL_SIZE: 20
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "6432:6432"
    networks:
      - omp-net

  # ── Backend API (updated) ─────────────────────────────────────────────────
  server:
    # ... existing config ...
    environment:
      DATABASE_URL: postgres://omp_user:${POSTGRES_PASSWORD:-omp_dev_password}@pgbouncer:6432/omp_database
      NODE_ENV: production
      PORT: 3001
    depends_on:
      pgbouncer:
        condition: service_started
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
    driver: local
```

#### [MODIFY] [Dockerfile.server](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/Dockerfile.server)

- **Remove**: `make g++ python3` build dependencies (no longer need `better-sqlite3` native compilation)
- **Remove**: SQLite binary engine generation flags
- **Keep**: Multi-stage build pattern, but simplify the builder stage

---

## Phase 2: Prisma Schema & Client

### [MODIFY] [schema.prisma](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/prisma/schema.prisma)

```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }
```

> [!NOTE]
> All existing model definitions, `@map` annotations, `@@map` table names, `@default(uuid())`, `@default(autoincrement())`, enums, `Json` fields, and relations are **fully compatible** with PostgreSQL. No model changes needed.

### [MODIFY] [prisma.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/lib/prisma.js)

**Remove** all SQLite-specific connection parameters:

```diff
- const rawUrl = process.env.DATABASE_URL || 'file:./dev.db';
- const connectionLimit = process.env.CONNECTION_LIMIT || (process.env.NODE_ENV === 'test' ? '5' : '1');
- const safetyParams = `connection_limit=${connectionLimit}&socket_timeout=10&busy_timeout=8000`;
- const dbUrlWithConcurrencyConfig = rawUrl.includes('?')
-   ? `${rawUrl}&${safetyParams}`
-   : `${rawUrl}?${safetyParams}`;
+ const dbUrl = process.env.DATABASE_URL || 'postgresql://omp_user:omp_dev_password@localhost:5432/omp_database';

  const basePrisma = withEmailTrigger(new PrismaClient({
-   datasources: {
-     db: {
-       url: dbUrlWithConcurrencyConfig,
-     },
-   },
+   datasources: {
+     db: {
+       url: dbUrl,
+     },
+   },
  }));
```

---

## Phase 3: Raw SQL Query Conversion

### [MODIFY] [adminAnalyticsController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/admin/adminAnalyticsController.js)

All 3 raw SQL queries use SQLite's `strftime()` and divide epoch milliseconds. PostgreSQL stores timestamps natively, so the conversion is straightforward:

#### Query 1: Monthly Granularity (line 96)

```diff
- SELECT
-   strftime('%Y-%m', created_at / 1000, 'unixepoch') AS period,
-   is_recurring AS "isRecurring",
-   SUM(amount) AS total
- FROM transactions
- WHERE status = 'SUCCEEDED'
-   AND created_at >= ${startMs}
-   AND created_at <= ${endMs}
- GROUP BY period, is_recurring

+ SELECT
+   to_char(created_at, 'YYYY-MM') AS period,
+   is_recurring AS "isRecurring",
+   SUM(amount) AS total
+ FROM transactions
+ WHERE status = 'SUCCEEDED'
+   AND created_at >= $1
+   AND created_at <= $2
+ GROUP BY period, is_recurring
```

#### Query 2: Yearly Granularity (line 138)

```diff
- strftime('%Y', created_at / 1000, 'unixepoch') AS period,
+ to_char(created_at, 'YYYY') AS period,
```

#### Query 3: Weekly/Biweekly Granularity (line 187)

```diff
- strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS period,
+ to_char(created_at, 'YYYY-MM-DD') AS period,
```

> [!IMPORTANT]
> **Date comparison change**: SQLite stores `created_at` as epoch milliseconds (integer). PostgreSQL stores it as a native `TIMESTAMP`. The `WHERE` clauses must switch from comparing integers (`>= ${startMs}`) to comparing `TIMESTAMP` values (`>= $1`) with proper parameterized queries using `prisma.$queryRaw` (tagged template) instead of `$queryRawUnsafe`.

> [!WARNING]
> **Security improvement**: The current queries use `$queryRawUnsafe` with string interpolation. The PostgreSQL conversion should switch to `$queryRaw` with tagged template literals and `Prisma.sql` for parameterized queries, eliminating SQL injection risk.

---

## Phase 4: Concurrency & Performance Improvements

### [MODIFY] [communicationQueue.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/workers/communicationQueue.js)

**Remove** the sequential fallback queue and enable parallel processing:

```diff
- // Fallback: queue jobs sequentially to prevent SQLite database lock concurrency conflicts
- fallbackQueue.push(data);
- setImmediate(processFallbackQueue);

+ // PostgreSQL supports concurrent writes — process jobs in parallel
+ setImmediate(() => processJob(data));
```

**Changes**:
- Remove the `fallbackQueue` array and `processingFallback` flag
- Remove `processFallbackQueue()` sequential loop
- Replace with direct parallel `processJob()` execution via `Promise.all` or concurrent `setImmediate` calls
- Update the `isEmpty()` check to track active job count instead of queue length

---

### [MODIFY] [contentController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/public/contentController.js)

**Remove** the in-memory cache layer:

```diff
- // In-memory cache — SQLite read concurrency workaround
- let cachedContent = null;
- let cacheTimestamp = 0;
- const CACHE_TTL_MS = 60_000;

+ // Direct database reads — PostgreSQL handles concurrent reads efficiently
```

**Changes**:
- Remove `cachedContent`, `cacheTimestamp`, `CACHE_TTL_MS` variables
- Remove cache-check logic in the GET handler
- Replace with direct `prisma.siteText.findMany()` calls
- Remove cache invalidation calls in the admin content PUT handler

---

### [MODIFY] [contentController.js (admin)](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/admin/contentController.js)

**Simplify** the batch update — remove the `$transaction` wrapper comment about "SQLITE_BUSY locking risks":

```diff
- * prisma.$transaction minimises database write time, drastically reducing SQLITE_BUSY locking risks.
+ * prisma.$transaction ensures atomicity — all content blocks update together or none do.
```

> [!NOTE]
> Keep the `$transaction` itself — it's still good practice for atomic batch updates. Only the SQLite-specific justification comment changes.

---

## Phase 5: Data Migration

### [NEW] `server/scripts/migrateToPostgres.js`

A Node.js ETL script that:

1. **Opens** the existing SQLite database using `better-sqlite3` (direct read, no Prisma)
2. **Connects** to the new PostgreSQL database using the Prisma client
3. **Migrates** tables in dependency order (foreign keys respected):

```
Migration Order:
  1. Users (no FK dependencies)
  2. Tiers
  3. DonationBoxes (FK → Tier)
  4. Transactions (FK → User)
  5. UserTiers (FK → User, Tier)
  6. ProjectDetails
  7. PiggyBanks (FK → ProjectDetail)
  8. Votes (FK → User, ProjectDetail, PiggyBank)
  9. DonationMilestones
  10. ClaimedMilestones (FK → User, DonationMilestone)
  11. WebsiteContent
  12. SiteText
  13. ReceiptSettings
  14. UserOtp
  15. AuditLog
  16. AllowedAdminEmail
  17. EmailTemplates
  18. AutomationTriggers (FK → EmailTemplate)
  19. AdminRoleAssignments (FK → AutomationTrigger)
  20. DispatchLogs (FK → EmailTemplate, Transaction)
  21. DispatchRecipients (FK → DispatchLog)
  22. InternalNotifications (FK → User)
```

4. **Handles** type conversions:
   - SQLite `INTEGER` epoch timestamps → PostgreSQL `TIMESTAMP` (for `created_at`, `updated_at`)
   - SQLite `TEXT` JSON strings → PostgreSQL `JSONB` (for `perks`, `pdfConfig`)
   - SQLite `INTEGER` booleans (0/1) → PostgreSQL `BOOLEAN` (true/false)

5. **Resets** auto-increment sequences after insert (PostgreSQL sequences don't auto-sync after manual ID inserts)

6. **Validates** row counts post-migration (source vs. destination)

### Migration Execution Steps

```bash
# 1. Start PostgreSQL container
docker-compose up -d postgres

# 2. Generate Prisma client for PostgreSQL
cd server && npx prisma generate

# 3. Push schema to PostgreSQL (creates empty tables)
npx prisma migrate dev --name init

# 4. Run the data migration script
node scripts/migrateToPostgres.js

# 5. Verify row counts
node scripts/verifyMigration.js
```

### [NEW] `server/scripts/verifyMigration.js`

A validation script that:
- Counts rows in every table in both SQLite and PostgreSQL
- Reports any mismatches
- Spot-checks a few records (e.g., admin user exists, sample transaction matches)

---

## Environment Configuration

### [MODIFY] `.env`

```diff
 # Database
-DATABASE_URL="file:./dev.db?busy_timeout=10000"
+DATABASE_URL="postgresql://omp_user:omp_dev_password@localhost:5432/omp_database"
```

### [NEW] `.env.example`

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://omp_user:your_password@localhost:5432/omp_database"
POSTGRES_PASSWORD="your_password"
```

---

## Test Infrastructure Updates

### [MODIFY] [run.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/tests/run.js)

```diff
  const server = spawn('node', [serverPath], {
    env: {
      ...process.env,
      PORT: TEST_PORT,
      NODE_ENV: 'test',
-     DATABASE_URL: 'file:./dev.db',
+     DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://omp_user:omp_dev_password@localhost:5432/omp_test',
      REDIS_URL: '',
    },
  });
```

### Test Database Strategy

- Create a separate `omp_test` database in the same PostgreSQL instance
- Before each test run: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` + `prisma migrate deploy`
- Seed required test data (admin accounts, etc.)

> [!IMPORTANT]
> **Major benefit**: PostgreSQL supports concurrent writes, so the SQLite write-lock deadlocks that plagued `communications.test.js` are **completely eliminated**. The test-only `/trigger-automation` HTTP route workaround can optionally be simplified back to direct imports if desired.

---

## Comment & Documentation Cleanup

Update SQLite-specific comments in ~8 files:

| File | Change |
|---|---|
| [communicationQueue.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/workers/communicationQueue.js) | Remove "SQLite database lock" comment |
| [contentController.js (public)](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/public/contentController.js) | Remove "SQLite read concurrency" comment |
| [contentController.js (admin)](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/admin/contentController.js) | Update `$transaction` justification |
| [adminAnalyticsController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/admin/adminAnalyticsController.js) | Remove "SQLite lacks advanced date grouping" |
| [subscriptionsController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/public/subscriptionsController.js) | Update "SQLite-safe transaction" comment |
| [adminProjectController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/admin/adminProjectController.js) | Update "SQLite safe cascade" comment |
| [prismaEmailTrigger.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/middleware/prismaEmailTrigger.js) | Update "stored as JSON array in SQLite" |
| Various test/script files | Update "SQLite" references in log messages |

---

## Files Changed Summary

| Action | File | Description |
|---|---|---|
| MODIFY | `schema.prisma` | `sqlite` → `postgresql` |
| MODIFY | `prisma.js` | Remove SQLite connection params |
| MODIFY | `adminAnalyticsController.js` | 3× raw SQL `strftime` → `to_char` |
| MODIFY | `communicationQueue.js` | Sequential → parallel processing |
| MODIFY | `contentController.js` (public) | Remove in-memory cache |
| MODIFY | `contentController.js` (admin) | Update comment |
| MODIFY | `docker-compose.yml` | Add PostgreSQL + PgBouncer services |
| MODIFY | `Dockerfile.server` | Remove SQLite native deps |
| MODIFY | `.env` | Update `DATABASE_URL` format |
| MODIFY | `run.js` | Update test `DATABASE_URL` |
| MODIFY | ~6 files | Comment cleanup |
| NEW | `scripts/migrateToPostgres.js` | Data migration ETL script |
| NEW | `scripts/verifyMigration.js` | Post-migration row count validator |
| DELETE | `prisma/dev.db` | SQLite database file (after migration verified) |
| DELETE | `prisma/dev.db-shm` | SQLite shared memory file |
| DELETE | `prisma/dev.db-wal` | SQLite write-ahead log |

---

## Execution Order

```mermaid
graph TD
    A["Phase 1: Docker Infrastructure"] --> B["Phase 2: Prisma Schema & Client"]
    B --> C["Phase 3: Raw SQL Conversion"]
    C --> D["Phase 4: Concurrency Improvements"]
    D --> E["Phase 5: Data Migration"]
    E --> F["Verification: Run full test suite"]
    F --> G["Cleanup: Delete SQLite files & comments"]
```

| Phase | Estimated Effort | Risk |
|---|---|---|
| 1. Docker Infrastructure | ~30 min | Low |
| 2. Prisma Schema & Client | ~15 min | Low |
| 3. Raw SQL Conversion | ~45 min | Medium (date comparison logic) |
| 4. Concurrency Improvements | ~30 min | Low |
| 5. Data Migration | ~1 hour | Medium (type conversions) |
| **Total** | **~3 hours** | |

---

## Verification Plan

### Automated Tests
- Run `node tests/run.js` — all 11 suites must pass against PostgreSQL
- Specifically verify analytics queries return correct date-grouped data

### Manual Verification
- `docker-compose up --build` — all 3 services (postgres, pgbouncer, server) start healthy
- Admin dashboard analytics charts render correctly
- Batch email dispatch completes without write-lock errors
- Public content pages load without caching delay

---

## Open Questions

> [!IMPORTANT]
> **Backup**: Before running the migration, we should create a backup copy of `dev.db`. Should this be committed to the repo (in a `backups/` folder) or just kept locally?

> [!WARNING]
> **AGENTS.md Rules**: Several rules in [AGENTS.md](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/.agents/AGENTS.md) reference SQLite-specific patterns (e.g., "SQLite Raw Query Schema Mapping", "SQLite Test Isolation"). These rules should be updated or removed after the migration to avoid confusion.

> [!NOTE]
> **`better-sqlite3` dependency**: The data migration script temporarily needs `better-sqlite3` as a dev dependency to read from the old SQLite file. After migration is complete, this dependency can be removed from `package.json`.
