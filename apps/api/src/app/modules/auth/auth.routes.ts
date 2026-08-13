import { loginSchema, registerSchema } from '@crossval/shared';
import { Router } from 'express';
import requireAuth from '../../middlewares/auth';
import { authRateLimiter } from '../../middlewares/rateLimiter';
import validateRequest from '../../middlewares/validateRequest';
import { authController } from './auth.controller';

const router = Router();

router.post('/register', authRateLimiter, validateRequest(registerSchema), authController.register);
router.post('/login', authRateLimiter, validateRequest(loginSchema), authController.login);
router.post('/refresh', authRateLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.getCurrentUser);

export const authRoutes = router;
