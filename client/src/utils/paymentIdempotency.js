const STORAGE_KEY = 'zayer_pending_payment_operations_v1'

function paymentStorageError(message, cause) {
  const error = new Error(message, cause ? { cause } : undefined)
  error.name = 'PaymentStorageError'
  return error
}

function withStorageLock(lockManager, operation) {
  if (typeof lockManager?.request !== 'function') {
    throw paymentStorageError('This browser cannot safely coordinate payment retries across tabs. No payment was sent.')
  }
  return lockManager.request('zayer-payment-operations', { mode: 'exclusive' }, operation)
}

function canonicalPayment(payment) {
  const amount = Number(payment.amount)
  const canonicalAmount = Math.round((amount + Number.EPSILON) * 100) / 100
  if (!Number.isFinite(canonicalAmount) || canonicalAmount < 0.01 || canonicalAmount > 100_000_000) {
    throw paymentStorageError('Payment amount is invalid. No payment was sent.')
  }
  return {
    amount: canonicalAmount,
    note: typeof payment.note === 'string' ? payment.note.trim() : '',
  }
}

function readOperations(storage) {
  const serialized = storage.getItem(STORAGE_KEY)
  if (serialized === null) return []

  let operations
  try {
    operations = JSON.parse(serialized)
  } catch {
    throw paymentStorageError('Saved payment retry data is invalid. Do not submit another payment until it is recovered.')
  }
  if (!Array.isArray(operations) || operations.some((operation) => (
    !operation
    || typeof operation.idempotencyKey !== 'string'
    || typeof operation.actorId !== 'string'
    || !['quote', 'retainer_collection'].includes(operation.resourceType)
    || typeof operation.resourceId !== 'string'
    || !Number.isFinite(operation.payment?.amount)
    || typeof operation.payment?.note !== 'string'
  ))) {
    throw paymentStorageError('Saved payment retry data is invalid. Do not submit another payment until it is recovered.')
  }
  return operations
}

function writeOperations(storage, operations) {
  storage.setItem(STORAGE_KEY, JSON.stringify(operations))
}

export function loadPendingPaymentOperations(storage, actorId) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw paymentStorageError('Persistent browser storage is unavailable. No payment was sent.')
  }
  try {
    return readOperations(storage).filter((operation) => operation.actorId === actorId)
  } catch (error) {
    if (error.name === 'PaymentStorageError') throw error
    throw paymentStorageError('Persistent browser storage is unavailable. No payment was sent.', error)
  }
}

export async function getOrCreatePendingPaymentOperation(storage, {
  actorId,
  resourceType,
  resourceId,
  payment,
  createKey = () => globalThis.crypto.randomUUID(),
  lockManager = globalThis.navigator?.locks,
}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw paymentStorageError('Persistent browser storage is unavailable. No payment was sent.')
  }
  if (typeof actorId !== 'string' || !actorId || !['quote', 'retainer_collection'].includes(resourceType)
    || typeof resourceId !== 'string' || !resourceId) {
    throw paymentStorageError('Payment retry data is incomplete. No payment was sent.')
  }

  const canonical = canonicalPayment(payment)
  try {
    return await withStorageLock(lockManager, () => {
      const operations = readOperations(storage)
      const existing = operations.find((operation) => (
        operation.actorId === actorId
        && operation.resourceType === resourceType
        && operation.resourceId === resourceId
        && operation.payment.amount === canonical.amount
        && operation.payment.note === canonical.note
      ))
      if (existing) return existing

      const operation = {
        idempotencyKey: createKey(),
        actorId,
        resourceType,
        resourceId,
        payment: canonical,
        createdAt: new Date().toISOString(),
      }
      if (
        typeof operation.idempotencyKey !== 'string'
        || operation.idempotencyKey.length < 16
        || operation.idempotencyKey.length > 128
        || !/^[A-Za-z0-9._:-]+$/.test(operation.idempotencyKey)
        || operations.some((candidate) => candidate.idempotencyKey === operation.idempotencyKey)
      ) {
        throw paymentStorageError('Could not create unique payment retry data. No payment was sent.')
      }
      writeOperations(storage, [...operations, operation])
      return operation
    })
  } catch (error) {
    if (error.name === 'PaymentStorageError') throw error
    throw paymentStorageError('Could not preserve payment retry data. No payment was sent.', error)
  }
}

export async function removePendingPaymentOperation(
  storage,
  actorId,
  idempotencyKey,
  lockManager = globalThis.navigator?.locks,
) {
  try {
    return await withStorageLock(lockManager, () => {
      const operations = readOperations(storage)
      const remaining = operations.filter((operation) => (
        operation.actorId !== actorId || operation.idempotencyKey !== idempotencyKey
      ))
      if (remaining.length !== operations.length) writeOperations(storage, remaining)
      return remaining
    })
  } catch (error) {
    if (error.name === 'PaymentStorageError') throw error
    throw paymentStorageError('Could not update saved payment retry data.', error)
  }
}
