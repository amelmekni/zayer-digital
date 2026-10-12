import { createHash } from 'node:crypto'

function requestError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

export function parseIdempotencyKey(value) {
  if (
    typeof value !== 'string'
    || value.length < 16
    || value.length > 128
    || !/^[A-Za-z0-9._:-]+$/.test(value)
  ) {
    throw requestError(400, 'A valid Idempotency-Key header is required.')
  }
  return value
}

export function createPaymentRequestHash({ resourceType, resourceId, amount, note }) {
  return createHash('sha256')
    .update(JSON.stringify([resourceType, String(resourceId), amount, note]))
    .digest('hex')
}

export function resolvePaymentReplay(record, requestHash) {
  if (record.requestHash !== requestHash) {
    throw requestError(409, 'Idempotency-Key has already been used for a different payment request.')
  }
  return record.response
}

export function assertPaymentWithinBalance(paidAmount, amount, total, message) {
  if (paidAmount + amount > total + 0.001) {
    throw requestError(409, message)
  }
}

export async function runIdempotentPayment({
  actorId,
  key,
  requestHash,
  session,
  findRecord,
  storeRecord,
  authorizeReplay,
  execute,
}) {
  const existing = await findRecord({ actorId, key, session })
  if (existing) {
    if (typeof authorizeReplay !== 'function') {
      throw new Error('A current-resource authorization check is required for payment replay.')
    }
    if (!await authorizeReplay({ session })) {
      throw requestError(404, 'Payment resource not found.')
    }
    return resolvePaymentReplay(existing, requestHash)
  }

  const response = await execute()
  await storeRecord({
    actorId,
    key,
    requestHash,
    response,
    session,
  })
  return response
}

export async function replayAfterDuplicateKey({
  error,
  actorId,
  key,
  requestHash,
  findRecord,
  authorizeReplay,
}) {
  if (error?.code !== 11000) throw error
  const record = await findRecord({ actorId, key })
  if (!record) throw error
  if (typeof authorizeReplay !== 'function') {
    throw new Error('A current-resource authorization check is required for payment replay.')
  }
  if (!await authorizeReplay()) throw requestError(404, 'Payment resource not found.')
  return resolvePaymentReplay(record, requestHash)
}
