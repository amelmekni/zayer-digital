import { Router } from 'express'
import {
  createService,
  deleteService,
  getServiceBySlug,
  getServices,
  updateService,
} from '../controllers/serviceController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireAdmin } from '../middleware/adminMiddleware.js'
import { validateObjectId } from '../middleware/validationMiddleware.js'

const router = Router()

router.route('/')
  .get(getServices)
  .post(authenticate, requireAdmin, createService)

router.get('/:slug', getServiceBySlug)
router.route('/:id')
  .put(authenticate, requireAdmin, validateObjectId(), updateService)
  .delete(authenticate, requireAdmin, validateObjectId(), deleteService)

export default router
