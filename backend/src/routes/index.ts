import { Router } from 'express';
import authRoutes from './auth.routes.js';
import masterRoutes from './master.routes.js';
import companyRoutes from './company.routes.js';
import documentRoutes from './document.routes.js';
import voucherRoutes from './voucher.routes.js';
import journalRoutes from './journal.routes.js';
import bankRoutes from './bank.routes.js';
import assetRoutes from './asset.routes.js';
import payrollRoutes from './payroll.routes.js';
import reportRoutes from './report.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/', masterRoutes);
router.use('/', companyRoutes);
router.use('/', documentRoutes);
router.use('/', voucherRoutes);
router.use('/', journalRoutes);
router.use('/', bankRoutes);
router.use('/', assetRoutes);
router.use('/', payrollRoutes);
router.use('/', reportRoutes);

export default router;

