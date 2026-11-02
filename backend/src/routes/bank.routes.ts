import { Router } from 'express';
import { BankController } from '../controllers/bank.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, FIN_READ, FIN_WRITE } from '../middleware/rbac.js';

const router = Router();

router.use(authMiddleware);

router.post('/bank/import', requireRole(...FIN_WRITE), BankController.importStatement);
router.post('/bank/automatch', requireRole(...FIN_WRITE), BankController.autoMatch);
router.get('/bank/reconcile', requireRole(...FIN_READ), BankController.getReconciliation);
router.get('/bank/statement/:id/candidates', requireRole(...FIN_READ), BankController.getCandidates);
router.post('/bank/statement/:id/match', requireRole(...FIN_WRITE), BankController.match);
router.post('/bank/statement/:id/create', requireRole(...FIN_WRITE), BankController.createFromStatement);

export default router;

