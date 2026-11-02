import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limit.js';

const router = Router();

// Rate limiters for brute-force protection
const loginLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 15,
  message: 'Too many login attempts. Please wait 1 minute before trying again.',
});

const registerLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 6,
  message: 'Too many registration requests. Please wait a few minutes before trying again.',
});

router.post('/login', loginLimiter, AuthController.login);
router.post('/register', registerLimiter, AuthController.register);
router.post('/switch', authMiddleware, AuthController.switchCompany);
router.post('/logout', AuthController.logout);
router.get('/me', authMiddleware, AuthController.me);

export default router;


