import { Router } from 'express';
import { JournalController } from '../controllers/journal.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, FIN_READ, FIN_WRITE } from '../middleware/rbac.js';

const router = Router();

router.use(authMiddleware);

router.get('/journals', requireRole(...FIN_READ), JournalController.list);
router.post('/journals', requireRole(...FIN_WRITE), JournalController.create);
router.get('/journals/:id', requireRole(...FIN_READ), JournalController.getOne);
router.post('/journals/:id/reverse', requireRole(...FIN_WRITE), JournalController.reverse);

export default router;

