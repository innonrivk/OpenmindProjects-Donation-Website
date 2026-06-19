# RBAC Implementation Plan — Security & Architecture Review

> **Reviewer Role:** Principal Security Engineer & Senior Software Architect
> **Review Date:** 2026-06-17
> **Source Plan:** [`implementation_plan.md`](file:///C:/Users/Lenovo/.gemini/antigravity-ide/brain/9dea8417-c2ad-474c-9b36-1085d84ec065/implementation_plan.md)

---

## Verdict Summary

The base plan is a solid foundation. However, four critical gaps were identified during review. All four must be addressed before the system is production-ready. Each finding includes a concrete, actionable resolution that has been confirmed through design alignment.

---

## Finding 1 — Architectural Scalability: Role Array Brittleness

### Problem

The plan proposes checking hardcoded role arrays per-route:
```javascript
// ❌ BRITTLE: Adding a 5th role means touching every single route file.
requireRole(['CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN'])
```
With 4 roles and ~8 protected route groups, this already means 32+ touchpoints. Adding a new `FINANCE_ADMIN` role in the future would require auditing every route file for errors — a classic source of security regressions.

### Resolution: Centralized `ROLE_PERMISSIONS` Constant Map

Replace the role-array pattern with a single source of truth: a permission constants file. Middleware then checks permissions, not role names.

#### [NEW] `server/src/config/permissions.js`

```javascript
/**
 * Centralized permission constants. Add a new role here to propagate
 * its access across the entire API automatically — zero route file changes needed.
 *
 * Why a Set? O(1) lookup vs. O(n) array.includes(), and prevents duplicate permissions.
 */
export const PERMISSIONS = Object.freeze({
  CAN_EDIT_CONTENT:       'CAN_EDIT_CONTENT',
  CAN_MANAGE_PROJECTS:    'CAN_MANAGE_PROJECTS',
  CAN_MANAGE_DONATIONS:   'CAN_MANAGE_DONATIONS',
  CAN_VIEW_TRANSACTIONS:  'CAN_VIEW_TRANSACTIONS',
  CAN_MANAGE_RECEIPTS:    'CAN_MANAGE_RECEIPTS',
  CAN_MANAGE_SETTINGS:    'CAN_MANAGE_SETTINGS',
  CAN_MANAGE_USERS:       'CAN_MANAGE_USERS',
});

/** Maps each role to its granted permissions. This is the single source of truth. */
export const ROLE_PERMISSIONS = Object.freeze({
  CONTENT_ADMIN:    new Set([PERMISSIONS.CAN_EDIT_CONTENT, PERMISSIONS.CAN_MANAGE_PROJECTS]),
  OPERATIONS_ADMIN: new Set([
    PERMISSIONS.CAN_EDIT_CONTENT,
    PERMISSIONS.CAN_MANAGE_PROJECTS,
    PERMISSIONS.CAN_MANAGE_DONATIONS,
    PERMISSIONS.CAN_MANAGE_RECEIPTS,
    PERMISSIONS.CAN_MANAGE_SETTINGS,
  ]),
  SUPER_ADMIN:      new Set([
    PERMISSIONS.CAN_EDIT_CONTENT,
    PERMISSIONS.CAN_MANAGE_PROJECTS,
    PERMISSIONS.CAN_MANAGE_DONATIONS,
    PERMISSIONS.CAN_VIEW_TRANSACTIONS,
    PERMISSIONS.CAN_MANAGE_RECEIPTS,
    PERMISSIONS.CAN_MANAGE_SETTINGS,
  ]),
  SYSADMIN:         new Set([
    PERMISSIONS.CAN_EDIT_CONTENT,
    PERMISSIONS.CAN_MANAGE_PROJECTS,
    PERMISSIONS.CAN_MANAGE_DONATIONS,
    PERMISSIONS.CAN_VIEW_TRANSACTIONS,
    PERMISSIONS.CAN_MANAGE_RECEIPTS,
    PERMISSIONS.CAN_MANAGE_SETTINGS,
    PERMISSIONS.CAN_MANAGE_USERS,
  ]),
});
```

#### [MODIFY] `server/src/middleware/rbacAuth.js`

```javascript
import { ROLE_PERMISSIONS } from '../config/permissions.js';

/**
 * Permission-based route guard. Checks a user's role against the ROLE_PERMISSIONS
 * map rather than a hardcoded array. Adding a new role requires no changes here.
 *
 * @param {string} permission - A PERMISSIONS constant string.
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.adminUser?.role;
    const userPermissions = ROLE_PERMISSIONS[userRole];

    if (!userPermissions || !userPermissions.has(permission)) {
      return res.status(403).json({
        error: 'forbidden',
        message: `Missing required permission: ${permission}`,
      });
    }
    next();
  };
};
```

**Route usage becomes:**
```javascript
// ✅ SCALABLE: Adding a 5th role only requires updating permissions.js
router.get('/transactions', requireAdminAuth, requirePermission(PERMISSIONS.CAN_VIEW_TRANSACTIONS), ...);
```

> [!IMPORTANT]
> Export `ROLE_PERMISSIONS` from the backend and also use it to drive the **frontend** sidebar visibility logic. This creates a single source of truth for both server-side enforcement and client-side UI rendering.

---

## Finding 2 — Security: Active Session Not Invalidated After Role Change

### Problem

When a Sysadmin demotes a user, their active JWT remains valid until it expires (up to 1 hour). During this window, the demoted user still has their old permissions. This is a **privilege persistence vulnerability**.

The current `requireAdminAuth` checks `dbUser.role` live on every request, but the JWT payload contains the stale role — and the live check re-reads the DB role, which would actually catch this. However, we must make this explicit and bulletproof.

### Resolution: `tokenVersion` Field on the User Model

This is the industry-standard mechanism for instant JWT invalidation without a token blocklist.

#### [MODIFY] `server/prisma/schema.prisma` — Add `tokenVersion` to `User`

```prisma
model User {
  // ... existing fields ...
  tokenVersion Int @default(0) @map("token_version")
  // ...
}
```

> [!IMPORTANT]
> Run `npx prisma db push` after this change.

#### [MODIFY] `server/src/middleware/adminAuth.js` — Validate version on every request

```javascript
// In issueAdminToken(), embed the version:
export function issueAdminToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
    ADMIN_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// In requireAdminAuth(), reject stale tokens:
const dbUser = await prisma.user.findUnique({
  where: { id: decoded.userId },
  select: { id: true, email: true, role: true, isActive: true, tokenVersion: true },
});

// ✅ Instant invalidation: if tokenVersion doesn't match, the token is stale.
if (!dbUser || !dbUser.isActive || dbUser.tokenVersion !== decoded.tokenVersion) {
  return res.status(401).json({ error: 'invalid_token', message: 'Session invalidated. Please log in again.' });
}
```

#### [MODIFY] `server/src/controllers/admin/adminUserController.js` — Increment version on role change

```javascript
// When a Sysadmin updates a user's role:
await prisma.user.update({
  where: { id: targetUserId },
  data: {
    role: newRole,
    tokenVersion: { increment: 1 }, // ← Atomically invalidates all existing sessions
  },
});
```

**Result:** The demoted user's next API request will fail the `tokenVersion` check and receive a `401`. They are forced to re-login, at which point they receive a JWT with their new, lower-privileged role.

---

## Finding 3 — Database Migration: Safe Transition of Existing `ADMIN` Users

### Problem

After expanding the `UserRole` enum, all existing users with `role: 'ADMIN'` will have an invalid role value. Since we're on **SQLite** (not PostgreSQL), `npx prisma db push` handles enum changes by recreating the affected table, which is safe but means we must run the data migration *after* the push.

### Resolution: Two-Step Migration

**Step 1: Schema Push**

Run once, after updating `schema.prisma` with the new enum values:
```bash
npx prisma db push
```

**Step 2: Automated Data Migration Script**

#### [NEW] `server/prisma/migrate-admin-roles.js`

```javascript
/**
 * One-time migration script: promotes all legacy ADMIN users to SYSADMIN.
 *
 * Why SYSADMIN? The Principle of Least Surprise — existing admins should not
 * find themselves locked out after an upgrade. They can be demoted manually
 * by the designated Sysadmin afterwards. This is safer than downgrading them.
 *
 * Run with: node server/prisma/migrate-admin-roles.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: { role: 'ADMIN' },
    data: { role: 'SYSADMIN' },
  });

  console.log(`✅ Migration complete. ${result.count} admin user(s) migrated to SYSADMIN.`);
}

main()
  .catch((e) => { console.error('❌ Migration failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

**Execution order:**
```bash
# 1. Update schema.prisma with new enum values
# 2. Push schema changes
npx prisma db push
# 3. Run one-time data migration
node server/prisma/migrate-admin-roles.js
# 4. Verify in admin UI that all former ADMIN users are now SYSADMIN
```

> [!WARNING]
> **Do not delete the old `ADMIN` enum value** from the schema until after the migration script has successfully run and been verified. Removing it prematurely will cause Prisma to reject the existing `ADMIN` values in the DB during the push.

---

## Finding 4 — Testing & Auditing: Zero Tests is Not Acceptable for Auth

### Problem

The plan states: *"No automated tests planned at this time."* This is unacceptable for an authentication and authorization system. A misconfigured permission in `requireRole` or `requirePermission` can silently expose sensitive routes to unauthorized users — with no failing test to catch it.

### Resolution A: Mandatory Test Coverage

**Minimum Viable Test Suite:**

#### Integration Tests (use Vitest + Supertest)
These are the absolute highest-priority tests. They verify the complete middleware chain, not just individual functions.

| Test | Scenario | Expected Result |
|---|---|---|
| `requirePermission.test.js` | `CONTENT_ADMIN` hits `GET /api/admin/transactions` | `403 Forbidden` |
| `requirePermission.test.js` | `SUPER_ADMIN` hits `GET /api/admin/transactions` | `200 OK` |
| `requirePermission.test.js` | `OPERATIONS_ADMIN` hits `GET /api/admin/transactions` | `403 Forbidden` |
| `requirePermission.test.js` | Unauthenticated request hits any `/api/admin/` route | `401 Unauthorized` |
| `adminUserController.test.js` | `SYSADMIN` attempts to change their **own** role | `400 Bad Request` |
| `adminUserController.test.js` | `SUPER_ADMIN` hits `PATCH /api/admin/users/:id` | `403 Forbidden` |
| `tokenVersion.test.js` | Role change increments `tokenVersion` | DB `tokenVersion` = old + 1 |
| `tokenVersion.test.js` | Stale JWT (old `tokenVersion`) is rejected | `401 Unauthorized` |

#### E2E Tests (use Playwright)
These verify the frontend guards are working, not just the backend.

| Test | Scenario | Expected Result |
|---|---|---|
| `sidebar.spec.js` | Login as `CONTENT_ADMIN`, check sidebar | Transactions link is **absent** |
| `roleGuard.spec.js` | Login as `CONTENT_ADMIN`, navigate to `/admin/dashboard/transactions` manually | Redirected to `/admin/dashboard` |
| `roleChange.spec.js` | Sysadmin changes a logged-in user's role | User's next request returns `401` |

### Resolution B: AuditLog Prisma Model

Create a permanent, queryable record of all security-sensitive events.

#### [NEW] `AuditLog` model in `server/prisma/schema.prisma`

```prisma
model AuditLog {
  id           Int      @id @default(autoincrement())
  actorId      String   @map("actor_id")       // Who performed the action
  targetUserId String?  @map("target_user_id") // Who was affected
  action       String                          // e.g., "ROLE_CHANGE"
  oldValue     String?  @map("old_value")      // e.g., "SUPER_ADMIN"
  newValue     String?  @map("new_value")      // e.g., "CONTENT_ADMIN"
  ipAddress    String?  @map("ip_address")
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([targetUserId])
  @@index([actorId])
  @@map("audit_logs")
}
```

#### [MODIFY] `server/src/controllers/admin/adminUserController.js` — Write audit event

```javascript
// After successfully updating the user's role:
await prisma.$transaction([
  prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole, tokenVersion: { increment: 1 } },
  }),
  // ✅ Atomic: role change and audit log always written together or not at all
  prisma.auditLog.create({
    data: {
      actorId:      req.adminUser.userId,
      targetUserId: targetUserId,
      action:       'ROLE_CHANGE',
      oldValue:     existingUser.role,
      newValue:     newRole,
      ipAddress:    req.ip,
    },
  }),
]);
```

> [!NOTE]
> By wrapping both writes in `prisma.$transaction`, we guarantee the audit log is never missing for a role change, and a role change is never made without an audit record. This is a hard atomicity requirement for a security-sensitive operation.

---

## Updated Implementation Checklist

Based on this review, the following items must be added to the execution plan:

- `[ ]` Create `server/src/config/permissions.js` with `ROLE_PERMISSIONS` map
- `[ ]` Refactor `rbacAuth.js` to use `requirePermission()` instead of `requireRole()`
- `[ ]` Add `tokenVersion Int @default(0)` to `User` model in `schema.prisma`
- `[ ]` Add `AuditLog` model to `schema.prisma`
- `[ ]` Run `npx prisma db push` after schema changes
- `[ ]` Create and run `server/prisma/migrate-admin-roles.js`
- `[ ]` Update `issueAdminToken()` to embed `tokenVersion` in the JWT payload
- `[ ]` Update `requireAdminAuth()` to validate `tokenVersion` from the DB
- `[ ]` Update user role-change controller to `increment tokenVersion` and write `AuditLog`
- `[ ]` Write integration test suite (Vitest + Supertest) for permission matrix
- `[ ]` Write E2E tests (Playwright) for frontend role guards
