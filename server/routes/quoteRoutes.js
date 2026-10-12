import { Router } from 'express'
import {
  createQuote,
  downloadQuotePdf,
  getQuoteById,
  getQuotes,
  recordQuotePayment,
  updateQuote,
  updateQuoteStatus,
} from '../controllers/quoteController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireSalesRole } from '../middleware/salesMiddleware.js'
import { validateObjectId } from '../middleware/validationMiddleware.js'

const router = Router()

router.use(authenticate, requireSalesRole)
router.route('/')
  .get(getQuotes)
  .post(createQuote)

router.route('/:id')
  .get(validateObjectId(), getQuoteById)
  .put(validateObjectId(), updateQuote)
router.get('/:id/pdf', validateObjectId(), downloadQuotePdf)
router.post('/:id/status', validateObjectId(), updateQuoteStatus)
router.post('/:id/payments', validateObjectId(), recordQuotePayment)

export default router
