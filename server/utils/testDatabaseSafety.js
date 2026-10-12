const reservedDatabaseName = 'zayer-digital-auth-test'
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function validateAuthTestDatabase({ uri, allowDestructive }) {
  if (allowDestructive !== '1') {
    throw new Error('Auth integration tests require explicit destructive-test opt-in.')
  }
  if (!uri) {
    throw new Error('Auth integration tests require MONGO_TEST_URI.')
  }

  let parsed
  try {
    parsed = new URL(uri)
  } catch {
    throw new Error('MONGO_TEST_URI must be a valid local MongoDB URI.')
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) {
    throw new Error('MONGO_TEST_URI must use the MongoDB protocol.')
  }
  if (!localHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error('Auth integration tests are restricted to a local MongoDB host.')
  }

  let databaseName
  try {
    databaseName = decodeURIComponent(parsed.pathname.slice(1))
  } catch {
    throw new Error('MONGO_TEST_URI must name the reserved auth test database.')
  }
  if (databaseName !== reservedDatabaseName) {
    throw new Error('MONGO_TEST_URI must name the reserved auth test database.')
  }
  if (!parsed.searchParams.get('replicaSet')?.trim()) {
    throw new Error('MONGO_TEST_URI must specify a replicaSet for transaction tests.')
  }

  parsed.pathname = `/${reservedDatabaseName}-${process.pid}`
  return parsed.href
}
