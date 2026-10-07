import { Router } from 'express'
import {
  createProject,
  deleteProject,
  getProjectBySlug,
  getProjects,
  updateProject,
} from '../controllers/projectController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireAdmin } from '../middleware/adminMiddleware.js'
import { validateObjectId } from '../middleware/validationMiddleware.js'

const router = Router()

router.route('/')
  .get(getProjects)
  .post(authenticate, requireAdmin, createProject)

router.get('/:slug', getProjectBySlug)
router.route('/:id')
  .put(authenticate, requireAdmin, validateObjectId(), updateProject)
  .delete(authenticate, requireAdmin, validateObjectId(), deleteProject)

export default router
