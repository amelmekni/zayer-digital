import mongoose from 'mongoose'
import Quote from '../models/Quote.js'
import RetainerCollection from '../models/RetainerCollection.js'
import PaymentIdempotency from '../models/PaymentIdempotency.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getAllowedFields, paginationMeta, parsePagination } from '../utils/apiQuery.js'
import { parseMoney, roundMoney } from '../utils/quoteDomain.js'
import {
  assertPaymentWithinBalance,
  createPaymentRequestHash,
  parseIdempotencyKey,
  replayAfterDuplicateKey,
  runIdempotentPayment,
} from '../utils/paymentIdempotency.js'
import { quoteAccess } from './quoteController.js'

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  throw error
}

function conflict(message) {
  const error = new Error(message)
  error.statusCode = 409
  throw error
}

function stateFor(collection, now) {
  if (collection.status === 'paid') return 'received'
  if (collection.dueAt <= now) return 'overdue'
  return collection.status === 'partial' ? 'partial' : 'upcoming'
}

async function canAccessCollection(user, collectionId, session) {
  let collectionQuery = RetainerCollection.findById(collectionId)
  if (session) collectionQuery = collectionQuery.session(session)
  const collection = await collectionQuery.select('quote').lean()
  if (!collection) return false
  return Boolean(await quoteAccess.assertCanRead(user, collection.quote, session))
}

export const getRetainerCollections = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query)
  const now = new Date()
  const ownerIds = req.user.role === 'admin'
    ? null
    : await Quote.find({ createdBy: req.user.id }).distinct('_id')
  const filter = ownerIds === null ? {} : { quote: { $in: ownerIds } }
  const states = ['upcoming', 'overdue', 'received', 'partial']
  if (req.query.state && !states.includes(req.query.state)) badRequest('Invalid collection state.')
  if (req.query.state === 'received') filter.status = 'paid'
  if (req.query.state === 'overdue') {
    filter.status = { $ne: 'paid' }
    filter.dueAt = { $lte: now }
  }
  if (req.query.state === 'partial') {
    filter.status = 'partial'
    filter.dueAt = { $gt: now }
  }
  if (req.query.state === 'upcoming') {
    filter.status = 'pending'
    filter.dueAt = { $gt: now }
  }

  const [rows, total] = await Promise.all([
    RetainerCollection.find(filter)
      .populate({ path: 'quote', select: 'quoteNumber client.name currency createdBy' })
      .sort({ dueAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RetainerCollection.countDocuments(filter),
  ])
  const data = rows.map((row) => ({
    ...row,
    collectionState: stateFor(row, now),
    outstandingAmount: roundMoney(row.amount - row.paidAmount),
  }))

  return res.json({
    success: true,
    data,
    meta: { pagination: paginationMeta(page, limit, total) },
  })
})

export const recordRetainerPayment = asyncHandler(async (req, res) => {
  const idempotencyKey = parseIdempotencyKey(req.get('Idempotency-Key'))
  const body = getAllowedFields(req.body, ['amount', 'note'])
  const amount = parseMoney(body.amount, 'amount', { minimum: 0.01 })
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > 300) badRequest('note cannot exceed 300 characters.')
  const requestHash = createPaymentRequestHash({
    resourceType: 'retainer_collection',
    resourceId: req.params.id,
    amount,
    note,
  })

  const session = await mongoose.startSession()
  let responseBody
  let duplicateError
  try {
    await session.withTransaction(async () => {
      responseBody = await runIdempotentPayment({
        actorId: req.user.id,
        key: idempotencyKey,
        requestHash,
        session,
        findRecord: ({ actorId, key, session: transaction }) => {
          let query = PaymentIdempotency.findOne({ actorId, key })
          if (transaction) query = query.session(transaction)
          return query.lean()
        },
        storeRecord: ({ actorId, key, requestHash: hash, response, session: transaction }) => (
          PaymentIdempotency.create([{
            actorId,
            key,
            requestHash: hash,
            response,
          }], { session: transaction })
        ),
        authorizeReplay: ({ session: transaction }) => (
          canAccessCollection(req.user, req.params.id, transaction)
        ),
        execute: async () => {
          const collection = await RetainerCollection.findById(req.params.id).session(session)
          if (!collection) {
            const error = new Error('Collection not found.')
            error.statusCode = 404
            throw error
          }
          const quote = await quoteAccess.assertCanRead(req.user, collection.quote, session)
          if (!quote) {
            const error = new Error('Collection not found.')
            error.statusCode = 404
            throw error
          }
          if (collection.status === 'paid') conflict('This installment is already fully paid.')
          assertPaymentWithinBalance(
            collection.paidAmount,
            amount,
            collection.amount,
            'The payment exceeds the outstanding installment balance.',
          )

          collection.payments.push({ amount, paidAt: new Date(), note })
          collection.paidAmount = roundMoney(collection.paidAmount + amount)
          collection.status = collection.paidAmount >= collection.amount ? 'paid' : 'partial'
          const updatedCollection = await collection.save({ session })
          return { success: true, data: updatedCollection.toObject() }
        },
      })
    })
  } catch (error) {
    if (error?.code !== 11000) throw error
    duplicateError = error
  } finally {
    await session.endSession()
  }
  if (duplicateError) {
    responseBody = await replayAfterDuplicateKey({
      error: duplicateError,
      actorId: req.user.id,
      key: idempotencyKey,
      requestHash,
      findRecord: ({ actorId, key }) => PaymentIdempotency.findOne({ actorId, key }).lean(),
      authorizeReplay: () => canAccessCollection(req.user, req.params.id),
    })
  }
  return res.json(responseBody)
})
