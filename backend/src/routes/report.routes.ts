import { Router } from 'express';
import { ReportController } from '../controllers/report.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, FIN_READ } from '../middleware/rbac.js';

const router = Router();

router.use(authMiddleware);

router.get('/reports/dashboard', requireRole(...FIN_READ), ReportController.dashboard);
router.get('/reports/trial-balance', requireRole(...FIN_READ), ReportController.trialBalance);
router.get('/reports/profit-loss', requireRole(...FIN_READ), ReportController.profitLoss);
router.get('/reports/balance-sheet', requireRole(...FIN_READ), ReportController.balanceSheet);
router.get('/reports/cash-flow', requireRole(...FIN_READ), ReportController.cashFlow);
router.get('/reports/ledger', requireRole(...FIN_READ), ReportController.generalLedger);
router.get('/reports/party-ledger', requireRole(...FIN_READ), ReportController.partyLedger);
router.get('/reports/ageing', requireRole(...FIN_READ), ReportController.ageing);
router.get('/reports/gst', requireRole(...FIN_READ), ReportController.gstReturns);
router.get('/reports/daybook', requireRole(...FIN_READ), ReportController.dayBook);
router.post('/years/:id/close', requireRole('OWNER'), ReportController.closeYear);

export default router;

