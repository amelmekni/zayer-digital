import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertPaymentIdempotencyIndex,
  validatePaymentTestDatabase,
} from '../utils/paymentTestDatabaseSafety.js'

const localReplicaSetUri = 'mongodb://127.0.0.1:27018/zayer-digital-payment-test?replicaSet=rs0'

test('accepts only an opted-in local replica-set payment database and isolates each process', () => {
  const result = validatePaymentTestDatabase({
    uri: localReplicaSetUri,
    allowPaymentTests: '1',
  })
  const parsed = new URL(result)

  assert.equal(parsed.hostname, '127.0.0.1')
  assert.equal(parsed.pathname, `/zayer-digital-payment-test-${process.pid}`)
  assert.equal(parsed.searchParams.get('replicaSet'), 'rs0')
})

test('fails closed without explicit opt-in or a dedicated URI', () => {
  assert.throws(
    () => validatePaymentTestDatabase({ uri: localReplicaSetUri }),
    /explicit test opt-in/,
  )
  assert.throws(
    () => validatePaymentTestDatabase({ allowPaymentTests: '1' }),
    /require MONGO_PAYMENT_TEST_URI/,
  )
})

test('rejects remote, multi-host, non-replica-set, and shared database URIs', () => {
  for (const uri of [
    'mongodb://example.invalid:27017/zayer-digital-payment-test?replicaSet=rs0',
    'mongodb://127.0.0.1:27017,127.0.0.1:27018/zayer-digital-payment-test?replicaSet=rs0',
    'mongodb://127.0.0.1:27017/zayer-digital-payment-test',
    'mongodb://127.0.0.1:27017/test?replicaSet=rs0',
    'mongodb+srv://localhost/zayer-digital-payment-test?replicaSet=rs0',
  ]) {
    assert.throws(
      () => validatePaymentTestDatabase({ uri, allowPaymentTests: '1' }),
    )
  }
})

test('requires the exact ordered unique actorId/key index', () => {
  assert.doesNotThrow(() => assertPaymentIdempotencyIndex([
    { name: '_id_', key: { _id: 1 } },
    { name: 'actorId_1_key_1', key: { actorId: 1, key: 1 }, unique: true },
  ]))
  assert.throws(() => assertPaymentIdempotencyIndex([
    { key: { actorId: 1, key: 1 }, unique: false },
  ]), /unique PaymentIdempotency index/)
  assert.throws(() => assertPaymentIdempotencyIndex([
    { key: { key: 1, actorId: 1 }, unique: true },
  ]), /unique PaymentIdempotency index/)
})
