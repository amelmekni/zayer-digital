import { Router } from 'express'
import {
  createJob,
  deleteJob,
  getJobBySlug,
  getJobs,
  updateJob,
} from '../controllers/jobController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireAdmin } from '../middleware/adminMiddleware.js'
import { validateObjectId } from '../middleware/validationMiddleware.js'

const router = Router()

router.route('/')
  .get(getJobs)
  .post(authenticate, requireAdmin, createJob)

router.get('/:slug', getJobBySlug)
router.route('/:id')
  .put(authenticate, requireAdmin, validateObjectId(), updateJob)
  .delete(authenticate, requireAdmin, validateObjectId(), deleteJob)

export default router
