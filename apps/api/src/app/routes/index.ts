import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';

const router = Router();

const moduleRoutes = [{ path: '/auth', route: authRoutes }];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
