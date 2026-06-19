import { Router } from 'express';
import { changeUserRole, listAdminUsers, removeAdmin } from '../../controllers/admin/adminUserController.js';
import { addAllowedEmail } from '../../controllers/admin/adminAllowedEmailController.js';
import { requirePermission } from '../../middleware/rbacAuth.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

/**
 * All routes mounted here require the CAN_MANAGE_USERS permission.
 * Why? User role and privilege modification is a critical system operation restricted exclusively to Sysadmins.
 */
router.use(requirePermission(PERMISSIONS.CAN_MANAGE_USERS));

router.get('/', listAdminUsers);
router.post('/', addAllowedEmail);
router.patch('/:id/role', changeUserRole);
router.delete('/:id', removeAdmin);

export default router;
