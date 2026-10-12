import { Router } from 'express'
import {
  getRetainerCollections,
  recordRetainerPayment,
} from '../controllers/retainerCollectionController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireSalesRole } from '../middleware/salesMiddleware.js'
import { validateObjectId } from '../middleware/validationMiddleware.js'

const router = Router()

router.use(authenticate, requireSalesRole)
router.get('/', getRetainerCollections)
router.post('/:id/payments', validateObjectId(), recordRetainerPayment)

export default router
