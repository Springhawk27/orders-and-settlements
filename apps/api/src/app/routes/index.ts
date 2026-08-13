import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { orderRoutes } from '../modules/order/order.routes';

const router = Router();

const moduleRoutes = [
  { path: '/auth', route: authRoutes },
  { path: '/orders', route: orderRoutes },
];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
