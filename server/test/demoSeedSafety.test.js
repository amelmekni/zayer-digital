import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertLocalReplicaSet,
  validateDemoSeedTarget,
} from '../utils/demoSeedSafety.js'

const localUri = 'mongodb://127.0.0.1:27017/zayer_digital_test?replicaSet=rs0'

test('accepts only an explicitly enabled development/test local demo database', () => {
  assert.deepEqual(validateDemoSeedTarget({
    nodeEnv: 'development',
    mongoUri: localUri,
    seedEnabled: '1',
  }), {
    mongoUri: localUri,
    databaseName: 'zayer_digital_test',
  })
})

test('fails closed without development mode or explicit opt-in', () => {
  assert.throws(() => validateDemoSeedTarget({
    nodeEnv: 'production',
    mongoUri: localUri,
    seedEnabled: '1',
  }), /only when NODE_ENV is development or test/)
  assert.throws(() => validateDemoSeedTarget({
    nodeEnv: 'development',
    mongoUri: localUri,
  }), /explicitly enable demo seeding/)
})

test('rejects remote hosts and any database other than the reserved demo database', () => {
  assert.throws(() => validateDemoSeedTarget({
    nodeEnv: 'test',
    mongoUri: 'mongodb://example.invalid/zayer_digital_test',
    seedEnabled: '1',
  }), /restricted to a loopback/)
  assert.throws(() => validateDemoSeedTarget({
    nodeEnv: 'test',
    mongoUri: 'mongodb://127.0.0.1:27017/production',
    seedEnabled: '1',
  }), /dedicated zayer_digital_test/)
})

test('requires a writable one-member loopback replica set with a matching port', () => {
  assert.doesNotThrow(() => assertLocalReplicaSet({
    setName: 'rs0',
    isWritablePrimary: true,
    hosts: ['127.0.0.1:27017'],
  }, { host: '127.0.0.1', port: 27017 }))
  assert.throws(() => assertLocalReplicaSet({
    setName: 'rs0',
    isWritablePrimary: true,
    hosts: ['remote.invalid:27017'],
  }, { host: '127.0.0.1', port: 27017 }), /loopback/)
  assert.throws(() => assertLocalReplicaSet({
    setName: 'rs0',
    isWritablePrimary: true,
    hosts: ['127.0.0.1:27017', 'localhost:27018'],
  }, { host: '127.0.0.1', port: 27017 }), /single-member/)
  assert.throws(() => assertLocalReplicaSet({
    setName: 'rs0',
    isWritablePrimary: false,
    hosts: ['127.0.0.1:27017'],
  }, { host: '127.0.0.1', port: 27017 }), /writable/)
})
