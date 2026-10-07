import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { env } from '../config/env.js'
import { asyncHandler } from '../utils/asyncHandler.js'

function unauthorized(res) {
  return res.status(401).json({
    success: false,
    error: { message: 'Authentication required.' },
  })
}

export const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.get('authorization')
  const match = authorization?.match(/^Bearer\s+(\S+)$/i)
  if (!match) return unauthorized(res)

  let payload
  try {
    payload = jwt.verify(match[1], env.jwtSecret, { algorithms: ['HS256'] })
  } catch {
    return unauthorized(res)
  }

  if (
    !payload
    || typeof payload !== 'object'
    || typeof payload.userId !== 'string'
    || !mongoose.isValidObjectId(payload.userId)
    || !['admin', 'user'].includes(payload.role)
  ) {
    return unauthorized(res)
  }

  const user = await User.findById(payload.userId)
    .select('_id name email role avatar')
    .lean()
  if (!user) return unauthorized(res)

  req.user = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.avatar && { avatar: user.avatar }),
  }

  return next()
})
