import { Router } from 'express'
import {
  createApplication,
  getApplicationById,
  getApplications,
  updateApplication,
} from '../controllers/applicationController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireAdmin } from '../middleware/adminMiddleware.js'
import { validateObjectId } from '../middleware/validationMiddleware.js'

const router = Router()

router.route('/')
  .post(createApplication)
  .get(authenticate, requireAdmin, getApplications)

router.route('/:id')
  .get(authenticate, requireAdmin, validateObjectId(), getApplicationById)
  .put(authenticate, requireAdmin, validateObjectId(), updateApplication)

export default router
