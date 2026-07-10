# Project Rules & Guidelines

## Chart Axis Rescaling Guidelines
*   **Dynamic Y-Axis Scaling:** When building interactive charts with multiple toggleable series (e.g., Monthly vs. One-Time), ensure that toggling/hiding a series dynamically recalculates the Y-axis maximum (`yMax`) based only on the remaining visible dataset series.
*   **Implementation:** Pass conditional arrays (e.g., `showSeries ? seriesData : []`) to the chart options generator function, or force a recalculation on state changes to prevent the chart from rendering flat/squished when high-value lines are hidden.

## SQLite Raw Query Schema Mapping
*   **Raw SQL Database-Level Names:** When executing raw database queries via Prisma (e.g. `prisma.$queryRaw`), always target the database-level mapped names (using snake_case or specific mapping targets defined by `@@map`/`@map` in `schema.prisma`), rather than camelCase Prisma model/field names.

## Resilient Queue / Worker Integrations
*   **Redis Offline Fallback:** When building queues/workers (e.g. BullMQ), always design a wrapper that detects missing configuration or connection failures and falls back to in-memory asynchronous execution (like `setImmediate`), preventing application crashes in environments without Redis.

## Prisma Client Connection Disconnects in Tests
*   **Mandatory Test Disconnects:** Any integration or edge test file that directly imports and utilizes the Prisma client must explicitly invoke `await prisma.$disconnect()` before the end of the test suite execution. This prevents active database connection pools from keeping the test runner process alive indefinitely.

## Browser Usage Minimization
*   **Lightweight Scripting Preference:** Never spawn the Chrome browser agent for checking database state, API endpoints, or user profile records. Instead, use lightweight node scripts (e.g., executing queries via Prisma or sending HTTP/fetch requests directly) to fetch information. Reserve the browser agent strictly for visual rendering and page-layout validations.

## Browser Tools Permission — One-Strike Rule
*   **No Re-Asking After Denial:** If the user declines a Browser Tools (`browser_subagent`) permission request even once in a session, treat that denial as permanent for the remainder of the conversation. Do NOT ask again for browser access on the same task or any subsequent sub-tasks.
*   **Pivot to Alternatives:** Immediately fall back to non-browser verification methods: lightweight Node scripts, direct API `fetch` calls, `grep_search`, `view_file`, or Prisma queries — as already required by the "Browser Usage Minimization" rule above.
*   **No Implicit Retry:** Do not rephrase or re-frame the same browser request hoping for a different outcome. The first denial is final.

## SQLite Test Isolation — No Direct Prisma Imports in Integration Test Files

*   **Anti-pattern:** Importing `../../src/lib/prisma.js` (or any Prisma client) directly inside integration test files that run **alongside** the test server.
*   **Why it breaks:** SQLite serializes write access. When the test process holds an open Prisma connection, any subsequent write from the concurrently-running test server blocks indefinitely — producing silent hangs with no error output. This is **not** a cascade issue, schema issue, or missing `$disconnect` call; it is a fundamental SQLite single-writer constraint.
*   **Correct pattern:** All database assertions in integration tests **must** use HTTP API calls to the test server. Direct Prisma queries are only permitted in:
    *   Pure unit test files (no server running in the same process or concurrently)
    *   Standalone diagnostic scripts run in isolation (no server running)
*   **If raw DB access is genuinely required** (e.g. seeding before server start), call `await prisma.$disconnect()` immediately after the seed completes and before the server process begins.
*   **Diagnosis signal:** If a simple HTTP request to the test server takes >10 seconds while a test process with a direct Prisma import is running, suspect a write-lock — not a network or route bug.

## Test Hang Loop Prevention

*   **Two-run maximum:** If a test suite (or isolated test file) produces **identical output across two consecutive runs** — same pass count, same last visible log line, same hang point — treat it as a deterministic failure. Do NOT run a third time without first diagnosing.
*   **Required diagnosis steps before re-running:**
    1.  Read the test file lines **immediately after** the last passing test to understand what the next test attempts.
    2.  Check for external resource contention: open DB connections, port conflicts, locked files, unreleased worker handles.
    3.  Run a **minimal isolated reproduction** in a single process (no server) to rule out environment vs. code issues.
*   **Scheduling timers to poll a running stuck task counts toward the two-run limit.** If the timer fires and no new output has appeared, treat that as the second identical run and stop to diagnose.
*   **Symptom → action table:**

    | Symptom | Likely Cause | First Action |
    |---------|-------------|--------------|
    | Hangs silently after a test that uses direct Prisma import | SQLite write-lock | Remove direct Prisma import; use HTTP instead |
    | Hangs on a `while (!queue.isEmpty())` poll | Queue worker stuck or never draining | Inspect the worker/queue drain logic |
    | HTTP request to test server takes minutes | Another process holds a DB write lock | Kill competing process, retry |

