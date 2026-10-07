import mongoose from 'mongoose'

export function validateObjectId(paramName = 'id') {
  return function objectIdValidator(req, res, next) {
    if (!mongoose.isValidObjectId(req.params[paramName])) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid ${paramName}.` },
      })
    }
    return next()
  }
}
