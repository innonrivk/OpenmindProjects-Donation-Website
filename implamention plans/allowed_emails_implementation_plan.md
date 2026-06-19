# Allowed Admin Emails — Role Invitation & Management System

Sysadmins can pre-assign admin roles to email addresses. When that email registers or logs in via Google, they are automatically promoted. Removal immediately demotes the user back to `DONOR`. The `CMSUsers` page is upgraded to a two-tab UI: **Active Admins** (existing admin users) + **Invited Emails** (pending pre-assignments).

**Access is purely role-based.** Donation tier checks have been deliberately omitted.

---

## User Review Required

> [!WARNING]
> **Database Schema Update**
> This change introduces a new `AllowedAdminEmail` model. Running `npx prisma db push` is required after the schema edit.

> [!IMPORTANT]
> **Immediate Side Effects**
> - Adding an email for an existing registered DONOR **immediately promotes** them to the assigned admin role and invalidates their active sessions via `tokenVersion` increment.
> - Removing an email for a registered admin **immediately demotes** them to `DONOR` and invalidates their sessions.
> - Protected users (`isProtected = true`) are **never demoted** automatically — a manual override is required.

---

## Proposed Changes

---

### 1. Database Schema

#### [MODIFY] [schema.prisma](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/prisma/schema.prisma)

Add `AllowedAdminEmail` model:

```prisma
model AllowedAdminEmail {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  role      UserRole
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("allowed_admin_emails")
}
```

---

### 2. Backend

#### [MODIFY] [adminUserController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/admin/adminUserController.js)

New exports to split into a second file `adminAllowedEmailController.js` to keep files under 250 lines:

**`listAllowedEmails(req, res, next)`** — `GET /users/allowed`
- Fetches all `AllowedAdminEmail` records.
- For each entry, performs a parallel `User` lookup to determine registration status and current role.
- Returns `{ id, email, role, isRegistered, currentRole }[]`.

**`addAllowedEmail(req, res, next)`** — `POST /users/allowed`
- Zod validates `{ email, role }`.
- Upserts the `AllowedAdminEmail` record.
- If a matching `User` exists and they are a `DONOR`: promote role + increment `tokenVersion` + create `AuditLog`. All writes in `prisma.$transaction`.

**`removeAllowedEmail(req, res, next)`** — `DELETE /users/allowed/:id`
- Deletes the `AllowedAdminEmail` entry.
- If a matching registered `User` exists AND `!user.isProtected`: demote to `DONOR` + increment `tokenVersion` + create `AuditLog`. All writes in `prisma.$transaction`.

**Update `changeUserRole`**
- After updating `User.role`, upsert/delete the corresponding `AllowedAdminEmail` entry to keep tables in sync.

---

#### [MODIFY] [users.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/routes/admin/users.js)

Mount new routes (all require `CAN_MANAGE_USERS`):

```js
router.get('/allowed', listAllowedEmails);
router.post('/allowed', addAllowedEmail);
router.delete('/allowed/:id', removeAllowedEmail);
```

---

#### [MODIFY] [authController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/public/authController.js)

In `googleLogin`:
- After resolving/creating the user, check `AllowedAdminEmail` for their email.
- If a match exists and `user.role === 'DONOR'`, promote them (transaction + `AuditLog`).

---

#### [MODIFY] [authUserController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/public/authUserController.js)

In `signup`:
- After creating the user, check `AllowedAdminEmail` for their email.
- If a match exists, promote them (transaction + `AuditLog`).

---

### 3. Frontend

#### [MODIFY] [CMSUsers.jsx](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/client/src/components/admin/CMSUsers.jsx)

Refactor into a two-tab layout. Extract tab content into separate files to respect the 250-line limit:

- **[NEW] `CMSUsersActive.jsx`** — Tab 1: Active Admins table with role change dropdowns (current behavior).
- **[NEW] `CMSUsersAllowed.jsx`** — Tab 2: Invited Emails table + Add Invite form.
- Each row: `email`, `role badge`, `Registered/Pending` status badge, Delete button with confirmation.
- Uses `useQuery` for fetch, `useMutation` for add/delete, with full query invalidation.

`CMSUsers.jsx` becomes the tab shell only (tab switching state + rendering sub-components).

---

#### [MODIFY] [AdminProtectedRoute.jsx](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/client/src/components/router/AdminProtectedRoute.jsx)
- If admin auth is not established but donor auth session has an admin role, call `upgradeAdminSession()` inline and show a spinner.
- Eliminates the `/login` → `/admin/dashboard` redirect loop.

#### [MODIFY] [PrivateRoute.jsx](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/client/src/components/router/PrivateRoute.jsx)
- If the authenticated donor has an admin role, redirect to `/admin/dashboard`.

---

## Verification Plan

### Manual Verification
1. Add `new-admin@test.com` → `CONTENT_ADMIN` in **Invited Emails** tab. Verify row shows "Pending".
2. Sign up with `new-admin@test.com`. Verify they are created as `CONTENT_ADMIN` and the row flips to "Registered".
3. Add `existing-donor@test.com` (existing DONOR) → `OPERATIONS_ADMIN`. Verify immediate promotion.
4. Delete the `existing-donor@test.com` invite. Verify immediate demotion to DONOR.
5. Verify `isProtected` users are NOT demoted when their invite is removed.
6. Navigate to `/admin/dashboard` as a donor-admin. Verify seamless auto-upgrade with no redirect to `/login`.
