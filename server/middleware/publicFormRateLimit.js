import rateLimit from 'express-rate-limit'

// Initial allowance: five submissions per IP per 15 minutes.
// The default memory store is process-local and is not shared across server instances.
const windowMs = 15 * 60 * 1000
const limit = 5

export function createPublicFormLimiter() {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      error: { message: 'Too many form submissions. Try again later.' },
    },
  })
}
