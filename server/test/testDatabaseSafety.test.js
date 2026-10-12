import assert from 'node:assert/strict'
import test from 'node:test'
import { validateAuthTestDatabase } from '../utils/testDatabaseSafety.js'

const localReplicaSetUri = 'mongodb://127.0.0.1:27017/zayer-digital-auth-test?replicaSet=rs0'

test('accepts an opted-in local replica-set URI and isolates the database per process', () => {
  const result = validateAuthTestDatabase({
    uri: localReplicaSetUri,
    allowDestructive: '1',
  })

  const parsed = new URL(result)
  assert.equal(parsed.hostname, '127.0.0.1')
  assert.equal(parsed.pathname, `/zayer-digital-auth-test-${process.pid}`)
  assert.equal(parsed.searchParams.get('replicaSet'), 'rs0')
})

test('fails closed when destructive tests are not explicitly enabled', () => {
  assert.throws(
    () => validateAuthTestDatabase({ uri: localReplicaSetUri }),
    /explicit destructive-test opt-in/,
  )
})

test('fails closed when no dedicated test URI is supplied', () => {
  assert.throws(
    () => validateAuthTestDatabase({ allowDestructive: '1' }),
    /require MONGO_TEST_URI/,
  )
})

test('rejects remote MongoDB hosts even when the database name looks test-only', () => {
  assert.throws(
    () => validateAuthTestDatabase({
      uri: 'mongodb+srv://example.invalid/zayer-digital-auth-test?replicaSet=rs0',
      allowDestructive: '1',
    }),
    /restricted to a local MongoDB host/,
  )
})

test('rejects shared or production database names', () => {
  assert.throws(
    () => validateAuthTestDatabase({
      uri: 'mongodb://127.0.0.1:27017/test?replicaSet=rs0',
      allowDestructive: '1',
    }),
    /reserved auth test database/,
  )
})

test('requires replica-set configuration for transaction tests', () => {
  assert.throws(
    () => validateAuthTestDatabase({
      uri: 'mongodb://127.0.0.1:27017/zayer-digital-auth-test',
      allowDestructive: '1',
    }),
    /specify a replicaSet/,
  )
})
