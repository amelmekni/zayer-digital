import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { after, before, test } from 'node:test'
import {
  assertPaymentIdempotencyIndex,
  validatePaymentTestDatabase,
} from '../utils/paymentTestDatabaseSafety.js'

const paymentTestUri = validatePaymentTestDatabase({
  uri: process.env.MONGO_PAYMENT_TEST_URI,
  allowPaymentTests: process.env.MONGO_PAYMENT_TEST_ALLOW,
})
const configuredPaymentUri = new URL(paymentTestUri)
const replicaSetName = configuredPaymentUri.searchParams.get('replicaSet')
const configuredPort = Number(configuredPaymentUri.port || 27017)
const testRunId = randomUUID()

process.env.NODE_ENV = 'test'
process.env.MONGO_URI = paymentTestUri
process.env.JWT_SECRET = randomBytes(48).toString('hex')
process.env.JWT_EXPIRES_IN = '15m'

let mongoose
let app
let User
let Quote
let QuoteSequence
let RetainerCollection
let PaymentIdempotency
let signAccessToken
let addUtcMonths
let server
let baseUrl
let testUsers
let sequenceWasAbsentAtStart = false
const createdUserIds = []
const createdQuoteIds = new Set()
const idempotencyKeys = new Set()

function hasUniqueIndex(indexes, keyPattern) {
  const expectedEntries = Object.entries(keyPattern)
  return indexes.some((index) => (
    index.unique === true
    && JSON.stringify(Object.entries(index.key || {})) === JSON.stringify(expectedEntries)
  ))
}

async function assertUniqueIndex(model, keyPattern, description) {
  const indexes = await model.collection.listIndexes().toArray()
  assert.ok(
    hasUniqueIndex(indexes, keyPattern),
    `Required unique index is missing or has the wrong key order: ${description}`,
  )
}

async function assertFreshCollection(model) {
  const count = await model.countDocuments({}).exec()
  assert.equal(
    count,
    0,
    `Refusing to use non-empty ${model.collection.collectionName} in the process-specific payment test database.`,
  )
}

function tokenFor(user) {
  return signAccessToken({
    id: user._id.toString(),
    role: user.role,
    tokenVersion: user.tokenVersion,
  })
}

function isLoopbackAddress(address) {
  const normalized = address.toLowerCase().replace(/%.*$/, '')
  return normalized === '::1'
    || normalized === '0:0:0:0:0:0:0:1'
    || /^127(?:\.\d{1,3}){3}$/.test(normalized)
}

function parseMemberAddress(address) {
  if (typeof address !== 'string') {
    throw new Error('MongoDB topology did not provide a valid replica-set member address.')
  }

  const match = address.match(/^\[([^\]]+)\]:(\d+)$/)
    || address.match(/^(.+):(\d+)$/)
  if (!match) {
    throw new Error('MongoDB topology did not provide an unambiguous host and port.')
  }

  const host = match[1].replace(/^\[|\]$/g, '').toLowerCase()
  const port = Number(match[2])
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MongoDB topology did not provide a valid host and port.')
  }
  return { host, port }
}

async function resolveLoopbackHost(host) {
  const normalized = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (isIP(normalized)) {
    assert.ok(isLoopbackAddress(normalized), 'MongoDB topology contains a non-loopback address.')
    return new Set([normalized.replace(/%.*$/, '')])
  }
  assert.equal(normalized, 'localhost', 'MongoDB topology contains a host other than localhost.')

  const resolved = await lookup(normalized, { all: true, verbatim: true })
  assert.ok(resolved.length > 0, 'localhost did not resolve to a MongoDB server address.')
  for (const { address } of resolved) {
    assert.ok(isLoopbackAddress(address), 'localhost resolved to a non-loopback address.')
  }
  return new Set(resolved.map(({ address }) => address.toLowerCase().replace(/%.*$/, '')))
}

async function assertConsistentLoopbackMember(address, expectedHost, description) {
  const parsed = parseMemberAddress(address)
  assert.equal(parsed.port, configuredPort, `${description} uses an unexpected MongoDB port.`)
  const addresses = await resolveLoopbackHost(parsed.host)
  const expectedAddresses = await resolveLoopbackHost(expectedHost)
  assert.ok(
    [...addresses].some((resolvedAddress) => expectedAddresses.has(resolvedAddress)),
    `${description} does not resolve to the configured local MongoDB instance.`,
  )
  return parsed
}

async function assertSameLoopbackMember(leftAddress, rightAddress, description) {
  const left = parseMemberAddress(leftAddress)
  const right = parseMemberAddress(rightAddress)
  assert.equal(left.port, right.port, `${description} use different MongoDB ports.`)
  const leftAddresses = await resolveLoopbackHost(left.host)
  const rightAddresses = await resolveLoopbackHost(right.host)
  assert.ok(
    [...leftAddresses].some((address) => rightAddresses.has(address)),
    `${description} do not resolve to the same local MongoDB member.`,
  )
}

async function assertLocalReplicaSetTopology(hello) {
  assert.equal(
    hello.setName,
    replicaSetName,
    'Payment integration tests require the configured MongoDB replica set.',
  )
  assert.equal(
    hello.hosts?.length,
    1,
    'Payment integration tests require a single-node MongoDB replica set.',
  )
  assert.equal(
    (hello.passives?.length || 0) + (hello.arbiters?.length || 0),
    0,
    'Payment integration tests refuse replica sets with passive members or arbiters.',
  )

  const configuredHost = configuredPaymentUri.hostname
  await resolveLoopbackHost(configuredHost)
  const [advertisedMember] = hello.hosts
  await assertConsistentLoopbackMember(advertisedMember, configuredHost, 'Advertised replica-set member')
  assert.ok(
    typeof hello.me === 'string',
    'MongoDB hello response did not identify the responding replica-set member.',
  )
  await assertConsistentLoopbackMember(hello.me, configuredHost, 'Responding replica-set member')
  await assertSameLoopbackMember(
    hello.me,
    advertisedMember,
    'The responding and advertised replica-set members',
  )

  const topology = mongoose.connection.getClient()?.topology
  const serverDescriptions = topology?.description?.servers
  assert.ok(
    serverDescriptions instanceof Map && serverDescriptions.size === 1,
    'MongoDB driver topology metadata is unavailable or ambiguous; refusing to write.',
  )
  const [serverDescription] = serverDescriptions.values()
  assert.ok(
    serverDescription?.address,
    'MongoDB driver did not expose the connected server address; refusing to write.',
  )
  await assertConsistentLoopbackMember(
    serverDescription.address,
    configuredHost,
    'MongoDB driver connected server',
  )
  await assertSameLoopbackMember(
    serverDescription.address,
    hello.me,
    'The MongoDB driver connected server and responding replica-set member',
  )
}

async function request(path, { actor, method = 'GET', body, idempotencyKey } = {}) {
  const headers = {}
  if (actor) headers.authorization = `Bearer ${actor.token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const responseBody = await response.json()
  if (
    method === 'POST'
    && path === '/api/quotes'
    && response.status === 201
    && responseBody?.data?._id
  ) {
    createdQuoteIds.add(responseBody.data._id)
  }
  return { status: response.status, body: responseBody }
}

function newIdempotencyKey() {
  const key = randomUUID()
  idempotencyKeys.add(key)
  return key
}

function quoteInput({ clientName, includeRetainer = false }) {
  const lineItems = [{
    kind: 'custom',
    title: 'Implementation',
    unit: 'project',
    quantity: 1,
    unitPrice: 100,
  }]

  if (includeRetainer) {
    lineItems.push({
      kind: 'retainer',
      title: 'Monthly support',
      unit: 'month',
      quantity: 2,
      unitPrice: 0,
      monthlyPrice: 50,
      includedMonths: 1,
      startDelayMonths: 1,
      contractMonths: 2,
    })
  }

  return {
    client: { name: clientName },
    currency: 'TND',
    lineItems,
  }
}

function quoteRecord({ createdBy, quoteNumber, includeRetainer = false }) {
  const lineItems = [{
    kind: 'custom',
    title: 'Collision fixture',
    unit: 'project',
    quantity: 1,
    unitPrice: 100,
  }]

  if (includeRetainer) {
    lineItems.push({
      kind: 'retainer',
      title: 'Monthly support',
      unit: 'month',
      quantity: 2,
      unitPrice: 0,
      monthlyPrice: 50,
      includedMonths: 1,
      startDelayMonths: 1,
      contractMonths: 2,
    })
  }

  return {
    createdBy,
    quoteNumber,
    client: { name: 'Integration Test Client' },
    currency: 'TND',
    lineItems,
    subtotal: 100,
    discountAmount: 0,
    taxRate: 0,
    taxAmount: 0,
    total: 100,
    depositRate: 0,
    depositAmount: 0,
    balanceAmount: 100,
    monthlyRecurringTotal: includeRetainer ? 100 : 0,
  }
}

before(async () => {
  [
    { default: mongoose },
    { default: app },
    { default: User },
    { default: Quote },
    { default: QuoteSequence },
    { default: RetainerCollection },
    { default: PaymentIdempotency },
    { signAccessToken },
    { addUtcMonths },
  ] = await Promise.all([
    import('mongoose'),
    import('../server.js'),
    import('../models/User.js'),
    import('../models/Quote.js'),
    import('../models/QuoteSequence.js'),
    import('../models/RetainerCollection.js'),
    import('../models/PaymentIdempotency.js'),
    import('../utils/jwt.js'),
    import('../utils/quoteDomain.js'),
  ])

  try {
    await mongoose.connect(paymentTestUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: false,
      autoCreate: false,
    })
  } catch (error) {
    throw new Error(
      `Could not connect to the guarded local payment-test replica set (${error.name || 'connection error'}).`,
    )
  }

  let hello
  try {
    hello = await mongoose.connection.db.admin().command({ hello: 1 })
  } catch (error) {
    throw new Error(
      `Could not verify the payment-test MongoDB replica set (${error.name || 'hello command failed'}).`,
    )
  }
  await assertLocalReplicaSetTopology(hello)

  for (const model of [Quote, RetainerCollection, PaymentIdempotency, QuoteSequence]) {
    await assertFreshCollection(model)
  }
  sequenceWasAbsentAtStart = !(await QuoteSequence.exists({ _id: 'quote' }))
  assert.ok(sequenceWasAbsentAtStart, 'Refusing to alter an existing quote sequence in the test database.')

  await Promise.all([
    Quote.createIndexes(),
    RetainerCollection.createIndexes(),
    PaymentIdempotency.createIndexes(),
  ])
  await Promise.all([
    assertUniqueIndex(Quote, { quoteNumber: 1 }, 'Quote.quoteNumber'),
    assertUniqueIndex(
      RetainerCollection,
      { quote: 1, quoteLineItem: 1, installmentNumber: 1 },
      'RetainerCollection { quote, quoteLineItem, installmentNumber }',
    ),
    (async () => {
      const indexes = await PaymentIdempotency.collection.listIndexes().toArray()
      assertPaymentIdempotencyIndex(indexes)
    })(),
  ])

  const transactionProbeSession = await mongoose.startSession()
  const probeActorId = new mongoose.Types.ObjectId()
  const probeKey = `probe-${randomUUID()}`
  try {
    await transactionProbeSession.withTransaction(async () => {
      await PaymentIdempotency.create([{
        actorId: probeActorId,
        key: probeKey,
        requestHash: '0'.repeat(64),
        response: { success: true },
      }], { session: transactionProbeSession })
      await PaymentIdempotency.deleteOne(
        { actorId: probeActorId, key: probeKey },
        { session: transactionProbeSession },
      )
    })
  } catch (error) {
    throw new Error(
      `MongoDB transaction preflight failed (${error.codeName || error.name || 'unknown error'}); use the guarded disposable single-node replica set.`,
    )
  } finally {
    await transactionProbeSession.endSession()
  }

  const passwordHash = await (await import('bcryptjs')).default.hash(
    randomBytes(32).toString('hex'),
    12,
  )
  testUsers = {}
  for (const [name, role] of [
    ['owner', 'sales_agent'],
    ['otherAgent', 'sales_agent'],
    ['regularUser', 'user'],
  ]) {
    const user = await User.create({
      name: `Integration ${name}`,
      email: `${testRunId}-${name}@example.test`,
      password: passwordHash,
      role,
      isActive: true,
      tokenVersion: 0,
    })
    createdUserIds.push(user._id)
    testUsers[name] = { id: user._id, token: tokenFor(user), role }
  }

  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  } finally {
    if (mongoose?.connection?.readyState === 1) {
      try {
        const runUserIds = new Map(createdUserIds.map((id) => [id.toString(), id]))
        const persistedRunUserIds = await User.find({
          email: { $regex: `^${testRunId}-` },
        }).distinct('_id')
        for (const userId of persistedRunUserIds) runUserIds.set(userId.toString(), userId)
        const runUserIdList = [...runUserIds.values()]
        const quoteIds = new Map([...createdQuoteIds].map((id) => [id.toString(), id]))
        if (runUserIdList.length) {
          const ownedQuoteIds = await Quote.find({
            createdBy: { $in: runUserIdList },
          }).distinct('_id')
          for (const quoteId of ownedQuoteIds) quoteIds.set(quoteId.toString(), quoteId)
        }
        const quoteIdList = [...quoteIds.values()]
        if (quoteIdList.length) {
          await RetainerCollection.deleteMany({ quote: { $in: quoteIdList } })
          await Quote.deleteMany({ _id: { $in: quoteIdList } })
        }
        if (idempotencyKeys.size && runUserIdList.length) {
          await PaymentIdempotency.deleteMany({
            actorId: { $in: runUserIdList },
            key: { $in: [...idempotencyKeys] },
          })
        }
        if (sequenceWasAbsentAtStart) {
          await QuoteSequence.deleteOne({ _id: 'quote' })
        }
        if (runUserIdList.length) {
          await User.deleteMany({ _id: { $in: runUserIdList } })
        }
      } finally {
        await mongoose.disconnect()
      }
    } else if (mongoose?.connection?.readyState) {
      await mongoose.disconnect()
    }
  }
})

test('quote sequence rollback, quote creation, and sales access', async (t) => {
  let retainerQuote
  let secondQuote

  await t.test('rolls back the sequence increment when quote creation collides', async () => {
    const collision = await Quote.create(quoteRecord({
      createdBy: testUsers.owner.id,
      quoteNumber: 'ZD-000001',
    }))
    createdQuoteIds.add(collision._id)

    const failed = await request('/api/quotes', {
      actor: testUsers.owner,
      method: 'POST',
      body: quoteInput({ clientName: 'Rollback Client' }),
    })
    assert.equal(failed.status, 409)
    assert.equal(await QuoteSequence.exists({ _id: 'quote' }), null)
    assert.equal(await Quote.countDocuments({ quoteNumber: 'ZD-000001' }), 1)

    await Quote.deleteOne({ _id: collision._id })
    createdQuoteIds.delete(collision._id)
  })

  await t.test('creates sequential quote numbers and scopes reads to the owner', async () => {
    const created = await request('/api/quotes', {
      actor: testUsers.owner,
      method: 'POST',
      body: quoteInput({ clientName: 'Retainer Client', includeRetainer: true }),
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.data.quoteNumber, 'ZD-000001')
    retainerQuote = created.body.data
    createdQuoteIds.add(retainerQuote._id)

    const second = await request('/api/quotes', {
      actor: testUsers.otherAgent,
      method: 'POST',
      body: quoteInput({ clientName: 'Second Client' }),
    })
    assert.equal(second.status, 201)
    assert.equal(second.body.data.quoteNumber, 'ZD-000002')
    secondQuote = second.body.data
    createdQuoteIds.add(secondQuote._id)

    assert.equal((await request(`/api/quotes/${retainerQuote._id}`, {
      actor: testUsers.otherAgent,
    })).status, 404)
    assert.equal((await request(`/api/quotes/${retainerQuote._id}`, {
      actor: testUsers.regularUser,
    })).status, 403)
    assert.equal((await request(`/api/quotes/${retainerQuote._id}`)).status, 401)
  })

  await t.test('rejects payment attempts on an unapproved quote without mutation', async () => {
    const key = newIdempotencyKey()
    const result = await request(`/api/quotes/${secondQuote._id}/payments`, {
      actor: testUsers.otherAgent,
      method: 'POST',
      body: { amount: 10, note: 'not approved' },
      idempotencyKey: key,
    })
    assert.equal(result.status, 409)
    const unchanged = await Quote.findById(secondQuote._id).lean()
    assert.equal(unchanged.payments.length, 0)
    assert.equal(unchanged.paidAmount, 0)
    assert.equal(await PaymentIdempotency.countDocuments({ key }), 0)
  })

  await t.test('approves the quote and persists the expected retainer installments', async () => {
    const sent = await request(`/api/quotes/${retainerQuote._id}/status`, {
      actor: testUsers.owner,
      method: 'POST',
      body: { status: 'sent' },
    })
    assert.equal(sent.status, 200)
    const approved = await request(`/api/quotes/${retainerQuote._id}/status`, {
      actor: testUsers.owner,
      method: 'POST',
      body: { status: 'approved' },
    })
    assert.equal(approved.status, 200)
    assert.equal(approved.body.data.status, 'approved')

    const persistedQuote = await Quote.findById(retainerQuote._id).lean()
    assert.equal(persistedQuote.status, 'approved')
    assert.ok(persistedQuote.approvedAt)
    const installments = await RetainerCollection.find({ quote: retainerQuote._id })
      .sort({ installmentNumber: 1 })
      .lean()
    assert.equal(installments.length, 2)
    for (const [index, installment] of installments.entries()) {
      assert.equal(installment.installmentNumber, index + 1)
      assert.equal(installment.amount, 100)
      assert.equal(
        installment.dueAt.toISOString(),
        addUtcMonths(persistedQuote.approvedAt, index + 3).toISOString(),
      )
    }

    const repeatedApproval = await request(`/api/quotes/${retainerQuote._id}/status`, {
      actor: testUsers.owner,
      method: 'POST',
      body: { status: 'approved' },
    })
    assert.equal(repeatedApproval.status, 409)
    assert.equal(await RetainerCollection.countDocuments({ quote: retainerQuote._id }), 2)

    const otherAgentPayment = await request(
      `/api/retainer-collections/${installments[0]._id}/payments`,
      {
        actor: testUsers.otherAgent,
        method: 'POST',
        body: { amount: 10 },
        idempotencyKey: newIdempotencyKey(),
      },
    )
    assert.equal(otherAgentPayment.status, 404)
    assert.equal((await RetainerCollection.findById(installments[0]._id).lean()).paidAmount, 0)
  })

  await t.test('records quote payments, replays exact requests, and rejects key reuse', async () => {
    const key = newIdempotencyKey()
    const payment = { amount: 25, note: 'deposit' }
    const first = await request(`/api/quotes/${retainerQuote._id}/payments`, {
      actor: testUsers.owner,
      method: 'POST',
      body: payment,
      idempotencyKey: key,
    })
    assert.equal(first.status, 200)
    const replay = await request(`/api/quotes/${retainerQuote._id}/payments`, {
      actor: testUsers.owner,
      method: 'POST',
      body: payment,
      idempotencyKey: key,
    })
    assert.equal(replay.status, 200)
    assert.deepEqual(replay.body, first.body)

    const changedRequest = await request(`/api/quotes/${retainerQuote._id}/payments`, {
      actor: testUsers.owner,
      method: 'POST',
      body: { amount: 26, note: 'deposit' },
      idempotencyKey: key,
    })
    assert.equal(changedRequest.status, 409)

    const persisted = await Quote.findById(retainerQuote._id).lean()
    assert.equal(persisted.payments.length, 1)
    assert.equal(persisted.paidAmount, 25)
    assert.equal(await PaymentIdempotency.countDocuments({
      actorId: testUsers.owner.id,
      key,
    }), 1)

    const excessiveKey = newIdempotencyKey()
    const excessivePayment = await request(`/api/quotes/${retainerQuote._id}/payments`, {
      actor: testUsers.owner,
      method: 'POST',
      body: { amount: 1000, note: 'over balance' },
      idempotencyKey: excessiveKey,
    })
    assert.equal(excessivePayment.status, 409)
    assert.equal(await PaymentIdempotency.countDocuments({ key: excessiveKey }), 0)
    assert.equal((await Quote.findById(retainerQuote._id).lean()).payments.length, 1)
  })

  await t.test('serializes concurrent duplicate quote payments through the database index', async () => {
    const key = newIdempotencyKey()
    const body = { amount: 10, note: 'concurrent retry' }
    const path = `/api/quotes/${retainerQuote._id}/payments`
    const [first, second] = await Promise.all([
      request(path, { actor: testUsers.owner, method: 'POST', body, idempotencyKey: key }),
      request(path, { actor: testUsers.owner, method: 'POST', body, idempotencyKey: key }),
    ])

    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.deepEqual(first.body, second.body)
    assert.equal(await Quote.countDocuments({
      _id: retainerQuote._id,
      paidAmount: 35,
    }), 1)
    const paymentCounts = await Quote.aggregate([
      { $match: { _id: retainerQuote._id } },
      { $project: { paymentCount: { $size: '$payments' } } },
    ])
    assert.equal(paymentCounts[0]?.paymentCount, 2)
    assert.equal(await PaymentIdempotency.countDocuments({
      actorId: testUsers.owner.id,
      key,
    }), 1)
  })
})

test('retainer payments persist once per idempotency key and respect balances', async () => {
  const quote = await Quote.findOne({ createdBy: testUsers.owner.id, quoteNumber: 'ZD-000001' }).lean()
  assert.ok(quote, 'The quote-creation workflow must complete before retainer payment checks.')
  const installment = await RetainerCollection.findOne({ quote: quote._id })
    .sort({ installmentNumber: 1 })
  assert.ok(installment, 'Quote approval must persist a retainer installment.')

  const key = newIdempotencyKey()
  const partialPayment = { amount: 30, note: 'first installment payment' }
  const first = await request(`/api/retainer-collections/${installment._id}/payments`, {
    actor: testUsers.owner,
    method: 'POST',
    body: partialPayment,
    idempotencyKey: key,
  })
  assert.equal(first.status, 200)
  assert.equal(await PaymentIdempotency.countDocuments({
    actorId: testUsers.owner.id,
    key,
  }), 1)
  const storedIdempotencyRecord = await PaymentIdempotency.findOne({
    actorId: testUsers.owner.id,
    key,
  }).lean()
  const replay = await request(`/api/retainer-collections/${installment._id}/payments`, {
    actor: testUsers.owner,
    method: 'POST',
    body: partialPayment,
    idempotencyKey: key,
  })
  assert.equal(replay.status, 200)
  assert.deepEqual(replay.body, first.body)
  assert.equal(await PaymentIdempotency.countDocuments({
    actorId: testUsers.owner.id,
    key,
  }), 1)
  assert.deepEqual(await PaymentIdempotency.findOne({
    actorId: testUsers.owner.id,
    key,
  }).lean(), storedIdempotencyRecord)

  const changedRequest = await request(`/api/retainer-collections/${installment._id}/payments`, {
    actor: testUsers.owner,
    method: 'POST',
    body: { amount: 35, note: partialPayment.note },
    idempotencyKey: key,
  })
  assert.equal(changedRequest.status, 409)
  assert.equal(await PaymentIdempotency.countDocuments({
    actorId: testUsers.owner.id,
    key,
  }), 1)
  assert.deepEqual(await PaymentIdempotency.findOne({
    actorId: testUsers.owner.id,
    key,
  }).lean(), storedIdempotencyRecord)
  let persisted = await RetainerCollection.findById(installment._id).lean()
  assert.equal(persisted.status, 'partial')
  assert.equal(persisted.paidAmount, 30)
  assert.equal(persisted.payments.length, 1)

  const finalPayment = await request(`/api/retainer-collections/${installment._id}/payments`, {
    actor: testUsers.owner,
    method: 'POST',
    body: { amount: 70, note: 'settlement' },
    idempotencyKey: newIdempotencyKey(),
  })
  assert.equal(finalPayment.status, 200)
  persisted = await RetainerCollection.findById(installment._id).lean()
  assert.equal(persisted.status, 'paid')
  assert.equal(persisted.paidAmount, 100)
  assert.equal(persisted.payments.length, 2)

  const excess = await request(`/api/retainer-collections/${installment._id}/payments`, {
    actor: testUsers.owner,
    method: 'POST',
    body: { amount: 1 },
    idempotencyKey: newIdempotencyKey(),
  })
  assert.equal(excess.status, 409)
  assert.equal((await RetainerCollection.findById(installment._id).lean()).payments.length, 2)
})
