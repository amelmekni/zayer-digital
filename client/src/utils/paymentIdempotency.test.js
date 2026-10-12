import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getOrCreatePendingPaymentOperation,
  loadPendingPaymentOperations,
  removePendingPaymentOperation,
} from './paymentIdempotency.js'

function createStorage() {
  const values = new Map()
  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
  }
}

function createLockManager() {
  let previous = Promise.resolve()
  return {
    request(_name, _options, operation) {
      const current = previous
      let release
      previous = new Promise((resolve) => { release = resolve })
      return current.then(operation).finally(release)
    },
  }
}

test('persists one key per logical operation and restores the exact retry after reload', async () => {
  const storage = createStorage()
  const lockManager = createLockManager()
  let sequence = 0
  const options = {
    actorId: 'agent-1',
    resourceType: 'quote',
    resourceId: 'quote-1',
    payment: { amount: 25, note: ' deposit ' },
    createKey: () => `payment-key-long-${++sequence}`,
    lockManager,
  }

  const first = await getOrCreatePendingPaymentOperation(storage, options)
  const restored = loadPendingPaymentOperations(storage, 'agent-1')
  const retry = await getOrCreatePendingPaymentOperation(storage, {
    ...options,
    payment: { amount: 25, note: 'deposit' },
  })

  assert.equal(restored.length, 1)
  assert.equal(retry.idempotencyKey, first.idempotencyKey)
  assert.deepEqual(retry.payment, { amount: 25, note: 'deposit' })
})

test('changed payment details or resource create separate records without replacing uncertain operations', async () => {
  const storage = createStorage()
  const lockManager = createLockManager()
  let sequence = 0
  const base = {
    actorId: 'agent-1',
    resourceType: 'quote',
    resourceId: 'quote-1',
    payment: { amount: 25, note: 'deposit' },
    createKey: () => `payment-key-long-${++sequence}`,
    lockManager,
  }
  const original = await getOrCreatePendingPaymentOperation(storage, base)
  const changedAmount = await getOrCreatePendingPaymentOperation(storage, {
    ...base,
    payment: { amount: 30, note: 'deposit' },
  })
  const changedNote = await getOrCreatePendingPaymentOperation(storage, {
    ...base,
    payment: { amount: 25, note: 'balance' },
  })
  const changedResource = await getOrCreatePendingPaymentOperation(storage, {
    ...base,
    resourceId: 'quote-2',
  })
  const changedType = await getOrCreatePendingPaymentOperation(storage, {
    ...base,
    resourceType: 'retainer_collection',
  })

  assert.equal(new Set([
    original.idempotencyKey,
    changedAmount.idempotencyKey,
    changedNote.idempotencyKey,
    changedResource.idempotencyKey,
    changedType.idempotencyKey,
  ]).size, 5)
  assert.equal(loadPendingPaymentOperations(storage, 'agent-1').length, 5)
  assert.equal(loadPendingPaymentOperations(storage, 'agent-2').length, 0)
})

test('concurrent identical submissions share the persisted operation', async () => {
  const storage = createStorage()
  const lockManager = createLockManager()
  let sequence = 0
  const options = {
    actorId: 'agent-1',
    resourceType: 'quote',
    resourceId: 'quote-1',
    payment: { amount: 25, note: '' },
    createKey: () => `payment-key-long-${++sequence}`,
    lockManager,
  }
  const [first, second] = await Promise.all([
    getOrCreatePendingPaymentOperation(storage, options),
    getOrCreatePendingPaymentOperation(storage, options),
  ])

  assert.equal(first.idempotencyKey, second.idempotencyKey)
  assert.equal(loadPendingPaymentOperations(storage, 'agent-1').length, 1)
})

test('removes an operation only when explicitly confirmed by its actor', async () => {
  const storage = createStorage()
  const lockManager = createLockManager()
  let sequence = 0
  const operation = await getOrCreatePendingPaymentOperation(storage, {
    actorId: 'agent-1',
    resourceType: 'retainer_collection',
    resourceId: 'collection-1',
    payment: { amount: 25, note: '' },
    createKey: () => `payment-key-long-${++sequence}`,
    lockManager,
  })

  assert.equal(loadPendingPaymentOperations(storage, 'agent-1').length, 1)
  assert.equal((await removePendingPaymentOperation(storage, 'agent-2', operation.idempotencyKey, lockManager)).length, 1)
  assert.equal((await removePendingPaymentOperation(storage, 'agent-1', operation.idempotencyKey, lockManager)).length, 0)
  const next = await getOrCreatePendingPaymentOperation(storage, {
    actorId: 'agent-1',
    resourceType: 'retainer_collection',
    resourceId: 'collection-1',
    payment: { amount: 25, note: '' },
    createKey: () => `payment-key-long-${++sequence}`,
    lockManager,
  })
  assert.notEqual(next.idempotencyKey, operation.idempotencyKey)
})
