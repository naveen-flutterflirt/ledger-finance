import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, FIN_READ, FIN_WRITE } from '../middleware/rbac.js';

const router = Router();

router.use(authMiddleware);

router.get('/docs/:kind', requireRole(...FIN_READ), DocumentController.list);
router.post('/docs/:kind', requireRole(...FIN_WRITE), DocumentController.create);
router.get('/docs/:kind/:id', requireRole(...FIN_READ), DocumentController.getOne);
router.put('/docs/:kind/:id', requireRole(...FIN_WRITE), DocumentController.updateDraft);
router.post('/docs/:kind/:id/post', requireRole(...FIN_WRITE), DocumentController.postDoc);
router.post('/docs/:kind/:id/cancel', requireRole(...FIN_WRITE), DocumentController.cancelDoc);

export default router;

