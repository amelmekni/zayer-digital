import { Router } from 'express'
import {
  createContactMessage,
  getContactMessageById,
  getContactMessages,
  updateContactMessage,
} from '../controllers/contactController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireAdmin } from '../middleware/adminMiddleware.js'
import { validateObjectId } from '../middleware/validationMiddleware.js'

const router = Router()

router.route('/')
  .post(createContactMessage)
  .get(authenticate, requireAdmin, getContactMessages)

router.route('/:id')
  .get(authenticate, requireAdmin, validateObjectId(), getContactMessageById)
  .put(authenticate, requireAdmin, validateObjectId(), updateContactMessage)

export default router
