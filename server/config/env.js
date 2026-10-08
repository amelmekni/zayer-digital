import 'dotenv/config'

const requiredVariables = ['MONGO_URI', 'JWT_SECRET']
const missingVariables = requiredVariables.filter((name) => !process.env[name]?.trim())

if (missingVariables.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`)
}

if (process.env.JWT_SECRET.trim().length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters.')
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN?.trim() || '15m'
if (!/^\d+(?:s|m|h|d)$/.test(jwtExpiresIn)) {
  throw new Error('JWT_EXPIRES_IN must use a duration such as 15m, 1h, or 7d.')
}

const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase() || 'development'
const exposeErrorDetails = Boolean(process.env.NODE_ENV?.trim())
  && ['development', 'test'].includes(nodeEnv)

export const env = Object.freeze({
  port: Number.parseInt(process.env.PORT || '5000', 10),
  mongoUri: process.env.MONGO_URI.trim(),
  jwtSecret: process.env.JWT_SECRET.trim(),
  jwtExpiresIn,
  bcryptRounds: 12,
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  nodeEnv,
  exposeErrorDetails,
})

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}
