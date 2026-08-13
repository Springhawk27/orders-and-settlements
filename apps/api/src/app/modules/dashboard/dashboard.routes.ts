import { Router } from 'express';
import requireAuth from '../../middlewares/auth';
import { dashboardController } from './dashboard.controller';

const router = Router();

router.use(requireAuth);
router.get('/summary', dashboardController.getSummary);

export const dashboardRoutes = router;
