import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function signAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, tokenVersion: user.tokenVersion || 0 },
    env.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: env.jwtExpiresIn,
    },
  )
}
