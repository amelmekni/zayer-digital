import assert from 'node:assert/strict'
import test from 'node:test'
import PaymentIdempotency from '../models/PaymentIdempotency.js'
import {
  assertPaymentWithinBalance,
  createPaymentRequestHash,
  parseIdempotencyKey,
  replayAfterDuplicateKey,
  resolvePaymentReplay,
  runIdempotentPayment,
} from '../utils/paymentIdempotency.js'

function createRequest(overrides = {}) {
  return {
    resourceType: 'quote',
    resourceId: 'quote-1',
    amount: 25,
    note: 'deposit',
    ...overrides,
  }
}

function makeRecordStore() {
  const records = new Map()
  let transactionQueue = Promise.resolve()

  return {
    async transact(operation) {
      let release
      const previous = transactionQueue
      transactionQueue = new Promise((resolve) => { release = resolve })
      await previous
      try {
        return await operation({})
      } finally {
        release()
      }
    },
    async findRecord({ actorId, key }) {
      return records.get(`${actorId}:${key}`) || null
    },
    async storeRecord(record) {
      const identity = `${record.actorId}:${record.key}`
      if (records.has(identity)) {
        const error = new Error('Duplicate key')
        error.code = 11000
        throw error
      }
      records.set(identity, record)
    },
  }
}

test('requires a bounded Idempotency-Key value', () => {
  assert.equal(parseIdempotencyKey('retry-key-123456'), 'retry-key-123456')
  assert.throws(() => parseIdempotencyKey(undefined), (error) => error.statusCode === 400)
  assert.throws(() => parseIdempotencyKey('short'), (error) => error.statusCode === 400)
})

test('fingerprints distinguish payment type, resource, amount, and note', () => {
  const original = createPaymentRequestHash(createRequest())
  assert.equal(createPaymentRequestHash(createRequest()), original)
  assert.notEqual(createPaymentRequestHash(createRequest({ amount: 30 })), original)
  assert.notEqual(createPaymentRequestHash(createRequest({ resourceId: 'quote-2' })), original)
  assert.notEqual(createPaymentRequestHash(createRequest({ resourceType: 'retainer_collection' })), original)
})

test('replays an exact request and rejects key reuse for a different request', async () => {
  const store = makeRecordStore()
  let executions = 0
  const requestHash = createPaymentRequestHash(createRequest())
  const run = () => store.transact((session) => runIdempotentPayment({
    actorId: 'agent-1',
    key: 'retry-key-123456',
    requestHash,
    session,
    findRecord: store.findRecord,
    storeRecord: store.storeRecord,
    authorizeReplay: async () => true,
    execute: async () => {
      executions += 1
      return { success: true, paymentId: 'payment-1' }
    },
  }))

  const initial = await run()
  const replay = await run()
  assert.deepEqual(replay, initial)
  assert.equal(executions, 1)
  assert.throws(() => resolvePaymentReplay({
    requestHash,
    response: initial,
  }, createPaymentRequestHash(createRequest({ amount: 30 }))), (error) => error.statusCode === 409)
})

test('different idempotency keys allow two real payments of the same amount', async () => {
  const store = makeRecordStore()
  let executions = 0
  const requestHash = createPaymentRequestHash(createRequest())
  const run = (key) => store.transact((session) => runIdempotentPayment({
    actorId: 'agent-1',
    key,
    requestHash,
    session,
    findRecord: store.findRecord,
    storeRecord: store.storeRecord,
    authorizeReplay: async () => true,
    execute: async () => ({ paymentId: `payment-${++executions}`, amount: 25 }),
  }))

  const first = await run('retry-key-123456')
  const second = await run('retry-key-654321')
  assert.notEqual(first.paymentId, second.paymentId)
  assert.equal(executions, 2)
})

test('concurrent exact submissions execute once in the transactional flow', async () => {
  const store = makeRecordStore()
  let executions = 0
  const requestHash = createPaymentRequestHash(createRequest())
  const run = () => store.transact((session) => runIdempotentPayment({
    actorId: 'agent-1',
    key: 'retry-key-123456',
    requestHash,
    session,
    findRecord: store.findRecord,
    storeRecord: store.storeRecord,
    authorizeReplay: async () => true,
    execute: async () => {
      executions += 1
      await new Promise((resolve) => setTimeout(resolve, 1))
      return { success: true, paymentId: 'payment-1' }
    },
  }))

  const responses = await Promise.all([run(), run()])
  assert.deepEqual(responses[0], responses[1])
  assert.equal(executions, 1)
})

test('resolves a unique-key race by replaying the committed record', async () => {
  const response = { success: true, paymentId: 'payment-1' }
  const requestHash = createPaymentRequestHash(createRequest())
  const replay = await replayAfterDuplicateKey({
    error: Object.assign(new Error('Duplicate key'), { code: 11000 }),
    actorId: 'agent-1',
    key: 'retry-key-123456',
    requestHash,
    findRecord: async () => ({ requestHash, response }),
    authorizeReplay: async () => true,
  })
  assert.deepEqual(replay, response)
})

test('checks current access before exact replay and never mutates on replay', async () => {
  const store = makeRecordStore()
  const requestHash = createPaymentRequestHash(createRequest())
  let mutations = 0
  let accessChecks = 0
  const run = (authorized) => runIdempotentPayment({
    actorId: 'agent-1',
    key: 'retry-key-123456',
    requestHash,
    findRecord: store.findRecord,
    storeRecord: store.storeRecord,
    authorizeReplay: async () => {
      accessChecks += 1
      return authorized
    },
    execute: async () => {
      mutations += 1
      return { success: true, paymentId: 'payment-1' }
    },
  })

  const initial = await runIdempotentPayment({
    actorId: 'agent-1',
    key: 'retry-key-123456',
    requestHash,
    findRecord: store.findRecord,
    storeRecord: store.storeRecord,
    authorizeReplay: async () => true,
    execute: async () => {
      mutations += 1
      return { success: true, paymentId: 'payment-1' }
    },
  })
  assert.deepEqual(await run(true), initial)
  await assert.rejects(run(false), (error) => error.statusCode === 404)
  assert.equal(accessChecks, 2)
  assert.equal(mutations, 1)
})

test('preserves a key-reuse conflict after confirming the actor can access the requested resource', async () => {
  const requestHash = createPaymentRequestHash(createRequest())
  const differentRequestHash = createPaymentRequestHash(createRequest({ amount: 30 }))
  await assert.rejects(replayAfterDuplicateKey({
    error: Object.assign(new Error('Duplicate key'), { code: 11000 }),
    actorId: 'agent-1',
    key: 'retry-key-123456',
    requestHash: differentRequestHash,
    findRecord: async () => ({
      requestHash,
      response: { success: true, paymentId: 'payment-1' },
    }),
    authorizeReplay: async () => true,
  }), (error) => error.statusCode === 409)
  await assert.rejects(replayAfterDuplicateKey({
    error: Object.assign(new Error('Duplicate key'), { code: 11000 }),
    actorId: 'agent-1',
    key: 'retry-key-123456',
    requestHash: differentRequestHash,
    findRecord: async () => ({
      requestHash,
      response: { success: true, paymentId: 'payment-1' },
    }),
    authorizeReplay: async () => false,
  }), (error) => error.statusCode === 404)
})

test('preserves the payment ceiling against the actual remaining balance', () => {
  assert.doesNotThrow(() => assertPaymentWithinBalance(25, 75, 100, 'over balance'))
  assert.throws(
    () => assertPaymentWithinBalance(25, 75.01, 100, 'over balance'),
    (error) => error.statusCode === 409 && error.message === 'over balance',
  )
  assert.throws(
    () => assertPaymentWithinBalance(0, 101, 100, 'over balance'),
    (error) => error.statusCode === 409,
  )
})

test('enforces a unique database index for each actor and idempotency key', () => {
  const uniqueIndexes = PaymentIdempotency.schema.indexes()
    .filter(([, options]) => options.unique)
  assert.deepEqual(uniqueIndexes, [[{ actorId: 1, key: 1 }, { unique: true, background: true }]])
})
