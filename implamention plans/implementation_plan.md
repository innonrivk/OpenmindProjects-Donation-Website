# Role-Based Access Control (RBAC) System

This document outlines the architectural changes required to implement a robust Role-Based Access Control (RBAC) system for the admin panel, as finalized during our design alignment.

## User Review Required

> [!WARNING]
> **Database Schema Changes**
> Expanding the `UserRole` enum will require running `npx prisma db push`. Existing users with the `ADMIN` role will need to be manually or programmatically migrated to one of the new specific admin roles (`CONTENT_ADMIN`, `OPERATIONS_ADMIN`, `SUPER_ADMIN`, or `SYSADMIN`) to maintain their access.

## Open Questions

None at this time. All design decisions were resolved during the `/grill-me` session.

---

## Proposed Changes

### 1. Database Schema

We will expand the existing `UserRole` enum in Prisma to support the explicit, fixed hierarchy of roles.

#### [MODIFY] `server/prisma/schema.prisma`
Update the `UserRole` enum. We will keep `DONOR` and `ADMIN` (if needed for backwards compatibility during migration, though `ADMIN` can be removed if a migration script assigns everyone a specific role).

```prisma
enum UserRole {
  DONOR
  CONTENT_ADMIN
  OPERATIONS_ADMIN
  SUPER_ADMIN
  SYSADMIN
}
```

> [!IMPORTANT]
> Once updated, we must run `npx prisma db push`.

---

### 2. Backend Authorization Logic

We will implement an explicit Allowed Roles Array approach. This cleanly handles the non-linear exclusions (e.g., Operations Admin has no access to Transactions, while Super Admin does).

#### [NEW] `server/src/middleware/rbacAuth.js`
Create a new middleware factory that accepts an array of allowed roles.

```javascript
/**
 * Middleware to restrict access based on an array of allowed roles.
 * Must be used AFTER requireAdminAuth (which verifies the JWT and DB active status).
 *
 * @param {string[]} allowedRoles - Array of UserRole strings allowed to access the route.
 */
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // req.adminUser is populated by requireAdminAuth
    const userRole = req.adminUser?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Insufficient privileges to access this resource.',
      });
    }

    next();
  };
};
```

#### [MODIFY] API Route Files (e.g., `server/src/routes/admin/*.js`)
Apply the `requireRole` middleware to specific route groups.

* **Content Routes** (Text, Projects): `requireRole(['CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN'])`
* **General Admin Routes** (Tiers, Donation Boxes, Settings): `requireRole(['OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN'])`
* **Transactions Routes**: `requireRole(['SUPER_ADMIN', 'SYSADMIN'])`
* **User Management Routes**: `requireRole(['SYSADMIN'])`

---

### 3. Frontend Routing & UI Logic

We will use a declarative Route Guard component to protect pages, and conditionally render the sidebar links to prevent unauthorized users from even seeing restricted tabs.

#### [NEW] `client/src/components/router/AdminRoleGuard.jsx`
A wrapper component for React Router.

```javascript
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminRoleGuard({ allowedRoles, children }) {
  const { adminUser } = useAdminAuth();

  if (!adminUser || !allowedRoles.includes(adminUser.role)) {
    // Redirect unauthorized users back to the safe default admin page (e.g., Content/Welcome)
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}
```

#### [MODIFY] `client/src/pages/AdminDashboardPage.jsx`
Wrap specific `<Route>` elements with the new guard.

```jsx
<Routes>
  {/* Accessible by everyone (Content Admin +) */}
  <Route path="/" element={<EditContentPage />} />
  <Route path="/projects" element={<CMSProjects />} />

  {/* Restricted to Operations, Super, Sysadmin */}
  <Route path="/settings" element={
    <AdminRoleGuard allowedRoles={['OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN']}>
      <AdminSettingsPage />
    </AdminRoleGuard>
  } />

  {/* Restricted to Super and Sysadmin */}
  <Route path="/transactions" element={
    <AdminRoleGuard allowedRoles={['SUPER_ADMIN', 'SYSADMIN']}>
      <CMSTransactions />
    </AdminRoleGuard>
  } />

  {/* Restricted to Sysadmin Only */}
  <Route path="/users" element={
    <AdminRoleGuard allowedRoles={['SYSADMIN']}>
      <CMSUsers />
    </AdminRoleGuard>
  } />
</Routes>
```

#### [MODIFY] `client/src/components/admin/AdminSidebar.jsx`
Conditionally render navigation `<NavLink>` items using `adminUser.role`.

```jsx
const { adminUser } = useAdminAuth();
const role = adminUser?.role;

// Example for Transactions:
{['SUPER_ADMIN', 'SYSADMIN'].includes(role) && (
  <NavLink to="/admin/dashboard/transactions">Transactions</NavLink>
)}
```

---

### 4. Security Best Practices

To prevent privilege escalation and secure the backend completely from direct API manipulation:

#### [MODIFY] `server/src/controllers/admin/adminUserController.js` (User Management)
Implement strict self-demotion prevention and strict payload validation using Zod.

1. **Role Stripping**: When a `PATCH /users/:id` request is received, the Zod schema will strictly strip the `role` field from the body *unless* the requesting user has the `SYSADMIN` role. This prevents a `SUPER_ADMIN` from intercepting the request and manually injecting `"role": "SYSADMIN"`.
2. **Self-Modification Block**: Inside the controller for updating a user, explicitly prevent a `SYSADMIN` from changing their *own* role to prevent accidental lockouts.

```javascript
// Example logic in User Controller
if (req.body.role && req.adminUser.userId === targetUserId) {
  return res.status(400).json({
    error: 'bad_request',
    message: 'Sysadmins cannot modify their own role. Another Sysadmin must do this.',
  });
}
```

## Verification Plan

### Automated Tests
None planned at this time. 

### Manual Verification
1. Open Admin Dashboard and login as a mock `CONTENT_ADMIN`.
2. Verify only the Content/Projects tabs are visible in the sidebar.
3. Manually type the URL `/admin/dashboard/transactions` and verify the `AdminRoleGuard` kicks you back to the main dashboard.
4. Attempt to hit the `GET /api/admin/transactions` endpoint via Postman with the `CONTENT_ADMIN` JWT, and verify a `403 Forbidden` response is returned.
5. Log in as a `SYSADMIN` and attempt to change your own role to `CONTENT_ADMIN`; verify the backend rejects the request.
