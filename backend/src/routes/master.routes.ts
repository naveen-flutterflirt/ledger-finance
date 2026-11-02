import { Router } from 'express';
import { MasterController } from '../controllers/master.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, FIN_READ, FIN_WRITE, PAY_READ, PAY_WRITE } from '../middleware/rbac.js';

const router = Router();

router.use(authMiddleware);

// Accounts
router.get('/accounts', requireRole(...FIN_READ), MasterController.listAccounts);
router.post('/accounts', requireRole(...FIN_WRITE), MasterController.createAccount);
router.put('/accounts/:id', requireRole(...FIN_WRITE), MasterController.updateAccount);

// Parties
router.get('/parties', MasterController.listParties);
router.post('/parties', requireRole(...FIN_WRITE), MasterController.createParty);
router.put('/parties/:id', requireRole(...FIN_WRITE), MasterController.updateParty);

// Items
router.get('/items', MasterController.listItems);
router.post('/items', requireRole(...FIN_WRITE), MasterController.createItem);
router.put('/items/:id', requireRole(...FIN_WRITE), MasterController.updateItem);

// Employees
router.get('/employees', requireRole(...PAY_READ), MasterController.listEmployees);
router.post('/employees', requireRole(...PAY_WRITE), MasterController.createEmployee);
router.put('/employees/:id', requireRole(...PAY_WRITE), MasterController.updateEmployee);

export default router;

