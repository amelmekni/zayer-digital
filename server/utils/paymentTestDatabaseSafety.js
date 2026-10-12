const reservedDatabaseName = 'zayer-digital-payment-test'
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function validatePaymentTestDatabase({ uri, allowPaymentTests }) {
  if (allowPaymentTests !== '1') {
    throw new Error('Payment integration tests require explicit test opt-in.')
  }
  if (!uri) {
    throw new Error('Payment integration tests require MONGO_PAYMENT_TEST_URI.')
  }

  let parsed
  try {
    parsed = new URL(uri)
  } catch {
    throw new Error('MONGO_PAYMENT_TEST_URI must be a valid local MongoDB URI.')
  }

  if (parsed.protocol !== 'mongodb:') {
    throw new Error('MONGO_PAYMENT_TEST_URI must use a local MongoDB protocol.')
  }
  if (!localHosts.has(parsed.hostname.toLowerCase()) || parsed.host.includes(',')) {
    throw new Error('Payment integration tests are restricted to one local MongoDB host.')
  }

  let databaseName
  try {
    databaseName = decodeURIComponent(parsed.pathname.slice(1))
  } catch {
    throw new Error('MONGO_PAYMENT_TEST_URI must name the reserved payment test database.')
  }
  if (databaseName !== reservedDatabaseName) {
    throw new Error('MONGO_PAYMENT_TEST_URI must name the reserved payment test database.')
  }
  if (!parsed.searchParams.get('replicaSet')?.trim()) {
    throw new Error('MONGO_PAYMENT_TEST_URI must specify a replicaSet for transaction tests.')
  }

  parsed.pathname = `/${reservedDatabaseName}-${process.pid}`
  return parsed.href
}

export function assertPaymentIdempotencyIndex(indexes) {
  if (!Array.isArray(indexes)) {
    throw new Error('Could not verify the PaymentIdempotency index.')
  }

  const hasRequiredIndex = indexes.some((index) => (
    index?.unique === true
    && JSON.stringify(Object.entries(index.key || {})) === JSON.stringify([['actorId', 1], ['key', 1]])
  ))
  if (!hasRequiredIndex) {
    throw new Error('The unique PaymentIdempotency index on { actorId: 1, key: 1 } is missing.')
  }
}
