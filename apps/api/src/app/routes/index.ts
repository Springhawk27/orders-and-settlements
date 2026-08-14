import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes.js';
import { orderRoutes } from '../modules/order/order.routes.js';
import { orderPaymentRoutes, paymentRoutes } from '../modules/payment/payment.routes.js';

const router = Router();

const moduleRoutes = [
  { path: '/auth', route: authRoutes },
  { path: '/dashboard', route: dashboardRoutes },
  // Registered before /orders so the nested path is matched first.
  { path: '/orders/:orderId/payments', route: orderPaymentRoutes },
  { path: '/orders', route: orderRoutes },
  { path: '/payments', route: paymentRoutes },
];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
