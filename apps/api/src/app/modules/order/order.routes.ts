import { createOrderSchema, updateOrderSchema } from '@crossval/shared';
import { Router } from 'express';
import requireAuth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { orderController } from './order.controller';

const router = Router();

// Every order route is scoped to the signed-in user.
router.use(requireAuth);

router.post('/', validateRequest(createOrderSchema), orderController.create);
router.get('/', orderController.list);
router.get('/:id', orderController.getById);
router.patch('/:id', validateRequest(updateOrderSchema), orderController.update);
router.delete('/:id', orderController.remove);
router.get('/:id/audit', orderController.listAuditTrail);

export const orderRoutes = router;
