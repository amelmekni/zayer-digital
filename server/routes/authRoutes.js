import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  getCurrentUser,
  login,
  register,
} from '../controllers/authController.js'
import { authenticate } from '../middleware/authMiddleware.js'

const router = Router()
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many authentication attempts. Try again later.' },
  },
})

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.get('/me', authenticate, getCurrentUser)

export default router
