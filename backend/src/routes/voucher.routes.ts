import { Router } from 'express';
import { VoucherController } from '../controllers/voucher.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, FIN_READ, FIN_WRITE } from '../middleware/rbac.js';

const router = Router();

router.use(authMiddleware);

router.get('/vouchers', requireRole(...FIN_READ), VoucherController.list);
router.post('/vouchers', requireRole(...FIN_WRITE), VoucherController.create);
router.get('/vouchers/:id', requireRole(...FIN_READ), VoucherController.getOne);
router.post('/vouchers/:id/cancel', requireRole(...FIN_WRITE), VoucherController.cancel);

export default router;

