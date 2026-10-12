import { Router } from 'express'
import {
  deleteUser,
  createAgent,
  getUserById,
  getUsers,
  setAgentStatus,
  updateUser,
} from '../controllers/userController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireAdmin } from '../middleware/adminMiddleware.js'
import { validateObjectId } from '../middleware/validationMiddleware.js'

const router = Router()

router.use(authenticate, requireAdmin)
router.post('/agents', createAgent)
router.patch('/agents/:id', validateObjectId(), setAgentStatus)
router.get('/', getUsers)
router.route('/:id')
  .get(validateObjectId(), getUserById)
  .put(validateObjectId(), updateUser)
  .delete(validateObjectId(), deleteUser)

export default router
