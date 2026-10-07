import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { env } from '../config/env.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getAllowedFields } from '../utils/apiQuery.js'
import { validatePassword } from '../utils/passwordPolicy.js'
import { signAccessToken } from '../utils/jwt.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const safeUserFields = 'name email role avatar createdAt updatedAt'

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.avatar && { avatar: user.avatar }),
  }
}

export const register = asyncHandler(async (req, res) => {
  const body = getAllowedFields(req.body, ['name', 'email', 'password'])
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = normalizeEmail(body.email)
  const passwordError = validatePassword(body.password)

  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({
      success: false,
      error: { message: 'Name must be between 2 and 100 characters.' },
    })
  }
  if (!emailPattern.test(email) || email.length > 254) {
    return res.status(400).json({
      success: false,
      error: { message: 'Enter a valid email address.' },
    })
  }
  if (passwordError) {
    return res.status(400).json({
      success: false,
      error: { message: passwordError },
    })
  }

  const passwordHash = await bcrypt.hash(body.password, env.bcryptRounds)
  const user = await User.create({
    name,
    email,
    password: passwordHash,
    role: 'user',
  })

  return res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: { user: safeUser(user) },
  })
})

export const login = asyncHandler(async (req, res) => {
  const body = getAllowedFields(req.body, ['email', 'password'])
  const email = normalizeEmail(body.email)

  if (!emailPattern.test(email) || email.length > 254 || typeof body.password !== 'string') {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid email or password.' },
    })
  }

  const user = await User.findOne({ email }).select('+password')
  const passwordMatches = user && Buffer.byteLength(body.password, 'utf8') <= 72
    ? await bcrypt.compare(body.password, user.password)
    : false

  if (!user || !passwordMatches) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid email or password.' },
    })
  }

  return res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: safeUser(user),
      token: signAccessToken(user),
    },
  })
})

export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select(safeUserFields).lean()
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required.' },
    })
  }

  return res.json({ success: true, data: { user: safeUser(user) } })
})
