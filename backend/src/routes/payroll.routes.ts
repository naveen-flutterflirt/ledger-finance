import { Router } from 'express';
import { PayrollController } from '../controllers/payroll.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, PAY_READ, PAY_WRITE } from '../middleware/rbac.js';

const router = Router();

router.use(authMiddleware);

// Employee payslips self-service
router.get('/me/payslips', PayrollController.myPayslips);
router.get('/payslips/:id', PayrollController.getPayslip);

// Payroll runs
router.get('/payroll', requireRole(...PAY_READ), PayrollController.listRuns);
router.post('/payroll', requireRole(...PAY_WRITE), PayrollController.createRun);
router.get('/payroll/:id', requireRole(...PAY_READ), PayrollController.getRun);
router.put('/payroll/:id/slips/:emp', requireRole(...PAY_WRITE), PayrollController.updateSlip);
router.post('/payroll/:id/post', requireRole(...PAY_WRITE), PayrollController.postRun);
router.post('/payroll/:id/pay', requireRole('OWNER', 'ACCOUNTANT', 'HR'), PayrollController.payRun);

export default router;

