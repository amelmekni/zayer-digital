const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export function parsePagination(query) {
  const page = parsePositiveInteger(query.page, DEFAULT_PAGE, 'page')
  const limit = Math.min(parsePositiveInteger(query.limit, DEFAULT_LIMIT, 'limit'), MAX_LIMIT)
  const skip = (page - 1) * limit

  if (!Number.isSafeInteger(skip)) {
    const error = new Error('Requested page is too large.')
    error.statusCode = 400
    throw error
  }

  return {
    page,
    limit,
    skip,
  }
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseSearch(value) {
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    const error = new Error('search must be a single string.')
    error.statusCode = 400
    throw error
  }

  const normalized = value.trim()
  if (normalized.length > 100) {
    const error = new Error('search cannot exceed 100 characters.')
    error.statusCode = 400
    throw error
  }

  return normalized ? new RegExp(escapeRegex(normalized), 'i') : undefined
}

export function parseEnumFilter(value, allowedValues, fieldName) {
  if (value === undefined) return undefined
  if (!allowedValues.includes(value)) {
    const error = new Error(`Invalid ${fieldName} filter. Allowed values: ${allowedValues.join(', ')}.`)
    error.statusCode = 400
    throw error
  }
  return value
}

export function parseBooleanFilter(value, fieldName) {
  if (value === undefined) return undefined
  if (value === 'true') return true
  if (value === 'false') return false
  const error = new Error(`${fieldName} filter must be "true" or "false".`)
  error.statusCode = 400
  throw error
}

export function paginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  }
}

function parsePositiveInteger(value, fallback, fieldName) {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    const error = new Error(`${fieldName} must be a positive integer.`)
    error.statusCode = 400
    throw error
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    const error = new Error(`${fieldName} is too large.`)
    error.statusCode = 400
    throw error
  }
  return parsed
}

export function getSortOrder(sort, allowedSorts, defaultSort) {
  if (sort === undefined) return defaultSort
  const order = allowedSorts[sort]
  if (!order) {
    const error = new Error(`Invalid sort option. Allowed values: ${Object.keys(allowedSorts).join(', ')}.`)
    error.statusCode = 400
    throw error
  }
  return order
}

export function getAllowedFields(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Request body must be a JSON object.')
    error.statusCode = 400
    throw error
  }

  if (Object.keys(body).length === 0) {
    const error = new Error('Request body cannot be empty.')
    error.statusCode = 400
    throw error
  }

  const unknownFields = Object.keys(body).filter((field) => !fields.includes(field))
  if (unknownFields.length > 0) {
    const error = new Error(`Unsupported field(s): ${unknownFields.join(', ')}.`)
    error.statusCode = 400
    throw error
  }

  return Object.fromEntries(
    Object.entries(body).filter(([field]) => fields.includes(field)),
  )
}
