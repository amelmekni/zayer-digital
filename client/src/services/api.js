export const AUTH_TOKEN_KEY = 'zayer_auth_token'

export class ApiError extends Error {
  constructor(message, status = 0, details = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

let unauthorizedHandler = () => {}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : () => {}
}

function readToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

function safeMessage(payload, status) {
  if (status === 0) return 'Unable to connect to the server.'
  if (status >= 500) return 'The server could not complete your request. Please try again.'
  const message = payload?.error?.message || payload?.message
  if (status === 409) {
    return /email/i.test(message || '')
      ? 'An account with this email already exists.'
      : 'This request conflicts with an existing record.'
  }
  if (status === 400 && Array.isArray(payload?.error?.details) && payload.error.details.length) {
    const validationMessage = payload.error.details[0]?.message
    if (typeof validationMessage === 'string' && validationMessage.trim()) return validationMessage
  }
  if (typeof message === 'string' && message.trim()) return message
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You are not authorized to perform this action.'
  if (status === 404) return 'The requested content could not be found.'
  if (status === 400) return 'Please check the information and try again.'
  return 'Something went wrong. Please try again.'
}

export async function request(path, { method = 'GET', body, headers = {}, auth = true, handleUnauthorized = true, ...options } = {}) {
  const apiBaseUrl = import.meta.env?.VITE_API_URL?.trim()
  if (!apiBaseUrl) throw new ApiError('The API URL is not configured. Set VITE_API_URL in client/.env.')
  const requestHeaders = new Headers(headers)
  requestHeaders.set('Accept', 'application/json')
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json')

  const token = auth ? readToken() : null
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`)

  let response
  try {
    response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}${path}`, {
      ...options,
      method,
      headers: requestHeaders,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch {
    throw new ApiError(safeMessage(null, 0))
  }

  let payload
  try {
    payload = response.status === 204 ? null : await response.json()
  } catch {
    payload = null
  }

  if (!response.ok || payload?.success === false) {
    const error = new ApiError(
      safeMessage(payload, response.status),
      response.status,
      Array.isArray(payload?.error?.details) ? payload.error.details : [],
    )
    if (response.status === 401 && token && handleUnauthorized) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY)
      unauthorizedHandler(error)
    }
    throw error
  }

  return payload
}

export function queryString(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
}
