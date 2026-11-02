import { Router } from 'express';
import { AssetController } from '../controllers/asset.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, FIN_READ, FIN_WRITE } from '../middleware/rbac.js';

const router = Router();

router.use(authMiddleware);

router.get('/assets', requireRole(...FIN_READ), AssetController.list);
router.post('/assets', requireRole(...FIN_WRITE), AssetController.create);
router.get('/assets/:id', requireRole(...FIN_READ), AssetController.getSchedule);
router.post('/assets/depreciate', requireRole(...FIN_WRITE), AssetController.runDepreciation);
router.post('/assets/:id/dispose', requireRole(...FIN_WRITE), AssetController.dispose);

export default router;

