import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { orderRoutes } from '../modules/order/order.routes';
import { orderPaymentRoutes, paymentRoutes } from '../modules/payment/payment.routes';

const router = Router();

const moduleRoutes = [
  { path: '/auth', route: authRoutes },
  // Registered before /orders so the nested path is matched first.
  { path: '/orders/:orderId/payments', route: orderPaymentRoutes },
  { path: '/orders', route: orderRoutes },
  { path: '/payments', route: paymentRoutes },
];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
