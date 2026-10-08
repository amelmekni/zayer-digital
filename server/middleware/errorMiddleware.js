import { env } from '../config/env.js'

export function notFound(req, res, next) {
  res.status(404)
  next(new Error(`Route not found: ${req.method} ${req.originalUrl}`))
}

export function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode
    || error.status
    || (['ValidationError', 'CastError', 'StrictModeError'].includes(error.name) ? 400 : 0)
    || (error.code === 11000 ? 409 : 0)
    || (res.statusCode >= 400 ? res.statusCode : 500)
  const exposeDebugDetails = env.exposeErrorDetails
  const message = statusCode === 500 && !exposeDebugDetails
    ? 'An unexpected server error occurred.'
    : error.message

  if (error.name === 'ValidationError') {
    return res.status(statusCode).json({
      success: false,
      error: {
        message: 'Validation failed.',
        details: Object.values(error.errors).map((item) => ({
          field: item.path,
          message: item.message,
        })),
      },
    })
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0]
    return res.status(statusCode).json({
      success: false,
      error: { message: `A record with this ${field || 'unique value'} already exists.` },
    })
  }

  if (statusCode >= 500) console.error(error)

  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(exposeDebugDetails && { stack: error.stack }),
    },
  })
}
