import { createOrderSchema, updateOrderSchema } from '@crossval/shared';
import { Router } from 'express';
import requireAuth from '../../middlewares/auth.js';
import validateRequest from '../../middlewares/validateRequest.js';
import { orderController } from './order.controller.js';

const router = Router();

// Every order route is scoped to the signed-in user.
router.use(requireAuth);

router.post('/', validateRequest(createOrderSchema), orderController.create);
router.get('/', orderController.list);

// Registered before /:id, which would otherwise treat "export" as an order id.
router.get('/export', orderController.exportCsv);

router.get('/:id', orderController.getById);
router.patch('/:id', validateRequest(updateOrderSchema), orderController.update);
router.delete('/:id', orderController.remove);
router.get('/:id/audit', orderController.listAuditTrail);

export const orderRoutes = router;
