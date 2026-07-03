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
