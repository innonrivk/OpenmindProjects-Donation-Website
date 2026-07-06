import { Router } from 'express';
import {
  changeUserRole,
  listAdminUsers,
  removeAdmin,
  listDonors,
  assignTierToUser,
  removeTierFromUser,
  deleteDonor,
} from '../../controllers/admin/adminUserController.js';
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

// Donor user & tier management routes
router.get('/donors', listDonors);
router.delete('/donors/:id', deleteDonor);
router.post('/:id/tiers', assignTierToUser);
router.delete('/:id/tiers/:tierId', removeTierFromUser);

export default router;

