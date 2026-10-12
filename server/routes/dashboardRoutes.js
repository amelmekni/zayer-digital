import { Router } from 'express'
import { getDashboardSummary } from '../controllers/dashboardController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireSalesRole } from '../middleware/salesMiddleware.js'

const router = Router()

router.use(authenticate, requireSalesRole)
router.get('/summary', getDashboardSummary)

export default router
