const MIN_PASSWORD_LENGTH = 12
const MAX_BCRYPT_BYTES = 72

export function validatePassword(password) {
  if (typeof password !== 'string') {
    return 'Password must be a string.'
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_BCRYPT_BYTES) {
    return `Password must not exceed ${MAX_BCRYPT_BYTES} UTF-8 bytes.`
  }
  return null
}
