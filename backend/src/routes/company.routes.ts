import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authMiddleware);

// Company profile & fiscal years
router.get('/company', CompanyController.getCompany);
router.put('/company', requireRole('OWNER'), CompanyController.updateCompany);
router.post('/company', CompanyController.createAdditionalCompany);

// Members
router.get('/members', requireRole('OWNER', 'ACCOUNTANT', 'HR'), CompanyController.listMembers);
router.post('/members', requireRole('OWNER'), CompanyController.addMember);
router.put('/members', requireRole('OWNER'), CompanyController.updateMemberPermissions);
router.delete('/members', requireRole('OWNER'), CompanyController.removeMember);

// Form Lookups
router.get('/lookups', CompanyController.getLookups);

export default router;

