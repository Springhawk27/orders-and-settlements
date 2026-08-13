import { recordPaymentSchema, voidPaymentSchema } from '@crossval/shared';
import { Router } from 'express';
import requireAuth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { paymentController } from './payment.controller';

// mergeParams so :orderId from the mount path reaches the controller.
const orderScoped = Router({ mergeParams: true });

orderScoped.use(requireAuth);
orderScoped.get('/', paymentController.listForOrder);
orderScoped.post('/', validateRequest(recordPaymentSchema), paymentController.record);
orderScoped.get('/reconcile', paymentController.reconcile);

const standalone = Router();

standalone.use(requireAuth);
standalone.post('/:id/void', validateRequest(voidPaymentSchema), paymentController.voidPayment);

export const orderPaymentRoutes = orderScoped;
export const paymentRoutes = standalone;
