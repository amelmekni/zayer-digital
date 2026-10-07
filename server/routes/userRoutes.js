import { Router } from 'express'
import {
  deleteUser,
  getUserById,
  getUsers,
  updateUser,
} from '../controllers/userController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireAdmin } from '../middleware/adminMiddleware.js'
import { validateObjectId } from '../middleware/validationMiddleware.js'

const router = Router()

router.use(authenticate, requireAdmin)
router.get('/', getUsers)
router.route('/:id')
  .get(validateObjectId(), getUserById)
  .put(validateObjectId(), updateUser)
  .delete(validateObjectId(), deleteUser)

export default router
