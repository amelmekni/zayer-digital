import mongoose from 'mongoose'
import Quote from '../models/Quote.js'
import QuoteSequence from '../models/QuoteSequence.js'
import RetainerCollection from '../models/RetainerCollection.js'
import PaymentIdempotency from '../models/PaymentIdempotency.js'
import Service from '../models/Service.js'
import PDFDocument from 'pdfkit'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getAllowedFields, paginationMeta, parseEnumFilter, parsePagination } from '../utils/apiQuery.js'
import {
  assertPaymentWithinBalance,
  createPaymentRequestHash,
  parseIdempotencyKey,
  replayAfterDuplicateKey,
  runIdempotentPayment,
} from '../utils/paymentIdempotency.js'
import {
  assertQuoteCurrencyUnchanged,
  buildRetainerInstallments,
  canTransitionQuoteStatus,
  calculatePaymentSummary,
  calculateQuote,
  getPaymentStatus,
  parseMoney,
  parseRate,
} from '../utils/quoteDomain.js'
import { pdfSafeText } from '../utils/pdfText.js'

const quoteStatuses = Quote.schema.path('status').enumValues
const paymentStatuses = Quote.schema.path('paymentStatus').enumValues
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function conflict(message) {
  const error = new Error(message)
  error.statusCode = 409
  return error
}

function boundedText(value, field, { required = false, max = 2000, min = 0 } = {}) {
  const text = typeof value === 'string' ? value.trim() : ''
  if ((required && text.length < Math.max(min, 1)) || text.length < min || text.length > max) {
    throw badRequest(`${field} must be between ${Math.max(min, required ? 1 : 0)} and ${max} characters.`)
  }
  return text
}

function parseClient(value) {
  const client = getAllowedFields(value, ['name', 'company', 'email', 'phone', 'address'])
  const email = boundedText(client.email, 'client.email', { max: 254 })
  if (email && !emailPattern.test(email)) throw badRequest('client.email must be a valid email address.')
  return {
    name: boundedText(client.name, 'client.name', { required: true, min: 2, max: 160 }),
    company: boundedText(client.company, 'client.company', { max: 160 }),
    email: email.toLowerCase(),
    phone: boundedText(client.phone, 'client.phone', { max: 40 }),
    address: boundedText(client.address, 'client.address', { max: 1000 }),
  }
}

async function buildLineItems(input, currency, session, existingQuote) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) {
    throw badRequest('lineItems must contain between 1 and 100 entries.')
  }

  return Promise.all(input.map(async (rawItem) => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw badRequest('Each line item must be an object.')
    }
    const kind = rawItem.kind
    if (!['service', 'custom', 'retainer'].includes(kind)) {
      throw badRequest('Each line item kind must be service, custom, or retainer.')
    }
    const quantity = parseMoney(rawItem.quantity, 'lineItem.quantity', { minimum: 0.01 })
    if (kind === 'service') {
      const item = getAllowedFields(rawItem, ['kind', 'serviceId', 'quantity'])
      if (!mongoose.isValidObjectId(item.serviceId)) throw badRequest('serviceId must be a valid ID.')
      const existingItem = existingQuote?.lineItems.find(
        (line) => line.kind === 'service' && line.service?.toString() === String(item.serviceId),
      )
      if (existingItem) {
        return {
          kind,
          service: existingItem.service,
          title: existingItem.title,
          description: existingItem.description,
          unit: existingItem.unit,
          quantity,
          unitPrice: existingItem.unitPrice,
          monthlyPrice: 0,
        }
      }
      const query = Service.findOne({ _id: item.serviceId, isActive: true })
      if (session) query.session(session)
      const service = await query.lean()
      if (!service) throw badRequest('The selected service does not exist or is inactive.')
      const serviceCurrency = (service.currency || 'TND').toUpperCase()
      if (serviceCurrency !== currency) throw badRequest('All service prices must use the quote currency.')
      if (!Number.isFinite(service.price)) throw badRequest('The selected service has no configured one-time price; use a custom line item.')
      return {
        kind,
        service: service._id,
        title: service.title,
        description: service.shortDescription || service.description || '',
        unit: service.unit || 'service',
        quantity,
        unitPrice: parseMoney(service.price, 'service.price'),
        monthlyPrice: 0,
      }
    }

    const allowedFields = kind === 'retainer'
      ? ['kind', 'title', 'description', 'unit', 'quantity', 'unitPrice', 'monthlyPrice', 'includedMonths', 'contractMonths', 'startDelayMonths']
      : ['kind', 'title', 'description', 'unit', 'quantity', 'unitPrice']
    const item = getAllowedFields(rawItem, allowedFields)
    const lineItem = {
      kind,
      title: boundedText(item.title, 'lineItem.title', { required: true, min: 2, max: 160 }),
      description: boundedText(item.description, 'lineItem.description', { max: 2000 }),
      unit: boundedText(item.unit, 'lineItem.unit', { required: true, max: 40 }),
      quantity,
      unitPrice: parseMoney(item.unitPrice, 'lineItem.unitPrice', { optional: kind === 'retainer' }),
      monthlyPrice: kind === 'retainer'
        ? parseMoney(item.monthlyPrice, 'lineItem.monthlyPrice', { optional: false })
        : 0,
    }
    if (kind === 'retainer') {
      const includedMonths = Number(item.includedMonths ?? 0)
      const startDelayMonths = Number(item.startDelayMonths ?? 0)
      const contractMonths = Number(item.contractMonths)
      if (!Number.isInteger(includedMonths) || includedMonths < 0 || includedMonths > 120) {
        throw badRequest('lineItem.includedMonths must be an integer from 0 to 120.')
      }
      if (!Number.isInteger(startDelayMonths) || startDelayMonths < 0 || startDelayMonths > 120) {
        throw badRequest('lineItem.startDelayMonths must be an integer from 0 to 120.')
      }
      if (!Number.isInteger(contractMonths) || contractMonths < 1 || contractMonths > 120) {
        throw badRequest('lineItem.contractMonths must be an integer from 1 to 120.')
      }
      lineItem.includedMonths = includedMonths
      lineItem.startDelayMonths = startDelayMonths
      lineItem.contractMonths = contractMonths
    }
    return lineItem
  }))
}

async function parseQuoteInput(body, session, existingQuote) {
  const input = getAllowedFields(body, [
    'client',
    'proposal',
    'currency',
    'lineItems',
    'discountAmount',
    'taxRate',
    'depositRate',
    'paymentTerms',
  ])
  const currency = typeof input.currency === 'string' ? input.currency.trim().toUpperCase() : ''
  if (!/^[A-Z]{3}$/.test(currency)) throw badRequest('currency must be a three-letter code.')

  assertQuoteCurrencyUnchanged(existingQuote, currency)
  const lineItems = await buildLineItems(input.lineItems, currency, session, existingQuote)
  const totals = calculateQuote(lineItems, {
    discountAmount: parseMoney(input.discountAmount, 'discountAmount', { optional: true }),
    taxRate: parseRate(input.taxRate, 'taxRate'),
    depositRate: parseRate(input.depositRate, 'depositRate'),
  })
  return {
    client: parseClient(input.client),
    proposal: boundedText(input.proposal, 'proposal', { max: 10000 }),
    currency,
    lineItems,
    ...totals,
    paymentTerms: boundedText(input.paymentTerms, 'paymentTerms', { max: 2000 }),
  }
}

function quoteFilterForUser(req) {
  return req.user.role === 'admin' ? {} : { createdBy: req.user.id }
}

async function findAccessibleQuote(id, req, session) {
  const filter = { _id: id, ...quoteFilterForUser(req) }
  let query = Quote.findOne(filter)
  if (session) query = query.session(session)
  return query
}

function serializeQuote(quote) {
  const data = quote.toObject ? quote.toObject() : quote
  return {
    ...data,
    outstandingBalance: Math.max(0, Math.round((data.total - data.paidAmount + Number.EPSILON) * 100) / 100),
  }
}

export const createQuote = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession()
  let created
  try {
    await session.withTransaction(async () => {
      const input = await parseQuoteInput(req.body, session)
      const sequence = await QuoteSequence.findOneAndUpdate(
        { _id: 'quote' },
        { $inc: { value: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session },
      )
      const quote = new Quote({
        ...input,
        quoteNumber: `ZD-${String(sequence.value).padStart(6, '0')}`,
        createdBy: req.user.id,
      })
      quote.paymentStatus = getPaymentStatus(quote.paidAmount, quote.total, quote.depositAmount)
      await quote.save({ session })
      created = quote
    })
  } finally {
    await session.endSession()
  }
  return res.status(201).json({ success: true, data: serializeQuote(created) })
})

export const getQuotes = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query)
  const filter = quoteFilterForUser(req)
  if (req.query.agentId !== undefined) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'Administrator access required.' } })
    }
    if (typeof req.query.agentId !== 'string' || !mongoose.isValidObjectId(req.query.agentId)) {
      throw badRequest('agentId must be a valid ID.')
    }
    filter.createdBy = req.query.agentId
  }
  const status = parseEnumFilter(req.query.status, quoteStatuses, 'status')
  const paymentStatus = parseEnumFilter(req.query.paymentStatus, paymentStatuses, 'paymentStatus')
  if (status) filter.status = status
  if (paymentStatus) filter.paymentStatus = paymentStatus

  const [quotes, total] = await Promise.all([
    Quote.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Quote.countDocuments(filter),
  ])
  return res.json({
    success: true,
    data: quotes.map(serializeQuote),
    meta: { pagination: paginationMeta(page, limit, total) },
  })
})

export const getQuoteById = asyncHandler(async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.id, ...quoteFilterForUser(req) })
    .populate('createdBy', 'name email role')
    .lean()
  if (!quote) return res.status(404).json({ success: false, error: { message: 'Quote not found.' } })
  return res.json({ success: true, data: serializeQuote(quote) })
})

export const downloadQuotePdf = asyncHandler(async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.id, ...quoteFilterForUser(req) }).lean()
  if (!quote) return res.status(404).json({ success: false, error: { message: 'Quote not found.' } })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${quote.quoteNumber}.pdf"`)
  res.setHeader('Cache-Control', 'private, no-store')
  const document = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true })
  document.on('error', (error) => {
    if (!res.headersSent) res.status(500).end()
    else res.destroy(error)
  })
  document.pipe(res)
  document.fillColor('#0a1628').font('Helvetica-Bold').fontSize(20).text('ZAYER Digital')
  document.moveDown(0.35)
  document.fontSize(14).text(`Quote ${pdfSafeText(quote.quoteNumber)}`)
  document.moveDown()
  document.font('Helvetica-Bold').fontSize(11).text('Client')
  document.font('Helvetica').fontSize(10)
  for (const value of [
    quote.client.name,
    quote.client.company,
    quote.client.email,
    quote.client.phone,
    quote.client.address,
  ]) {
    if (value) document.text(pdfSafeText(value))
  }
  document.moveDown()
  document.font('Helvetica-Bold').fontSize(11).text('Proposal')
  document.font('Helvetica').fontSize(10).text(pdfSafeText(quote.proposal || ''))
  document.moveDown()
  document.font('Helvetica-Bold').fontSize(11).text('Services')
  document.moveDown(0.3)
  for (const item of quote.lineItems) {
    document.font('Helvetica-Bold').fontSize(10)
      .text(`${pdfSafeText(item.title)} (${item.quantity} ${pdfSafeText(item.unit)})`)
    if (item.description) {
      document.font('Helvetica').fontSize(9).text(pdfSafeText(item.description))
    }
    if (item.unitPrice > 0) {
      document.text(`One-time unit price: ${item.unitPrice.toFixed(2)} ${quote.currency}`)
    }
    if (item.kind === 'retainer') {
      document.text(
        `Recurring unit price: ${item.monthlyPrice.toFixed(2)} ${quote.currency}/month x ${item.contractMonths} months; `
        + `${item.includedMonths} included months; ${item.startDelayMonths} months start delay.`,
      )
    }
    document.moveDown(0.5)
  }
  document.moveDown(0.5)
  document.font('Helvetica-Bold').fontSize(10).text(`Subtotal: ${quote.subtotal.toFixed(2)} ${quote.currency}`)
  document.font('Helvetica').text(`Discount: ${quote.discountAmount.toFixed(2)} ${quote.currency}`)
  document.text(`Tax (${quote.taxRate}%): ${quote.taxAmount.toFixed(2)} ${quote.currency}`)
  document.font('Helvetica-Bold').text(`Total: ${quote.total.toFixed(2)} ${quote.currency}`)
  document.font('Helvetica').text(`Deposit (${quote.depositRate}%): ${quote.depositAmount.toFixed(2)} ${quote.currency}`)
  const paymentSummary = calculatePaymentSummary(quote)
  document.text(`Amount paid: ${paymentSummary.paidAmount.toFixed(2)} ${quote.currency}`)
  document.text(`Balance due: ${paymentSummary.outstandingBalance.toFixed(2)} ${quote.currency}`)
  document.text(`Recurring monthly total: ${quote.monthlyRecurringTotal.toFixed(2)} ${quote.currency}`)
  document.moveDown()
  document.font('Helvetica-Bold').text('Payment terms')
  document.font('Helvetica').text(pdfSafeText(quote.paymentTerms || ''))
  if (quote.payments.length) {
    document.moveDown()
    document.font('Helvetica-Bold').text('Payments received')
    document.font('Helvetica')
    for (const payment of quote.payments) {
      document.text(`${payment.paidAt.toISOString().slice(0, 10)} - ${payment.amount.toFixed(2)} ${quote.currency}`)
    }
  }
  document.end()
})

export const updateQuote = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession()
  let updated
  try {
    await session.withTransaction(async () => {
      const quote = await findAccessibleQuote(req.params.id, req, session)
      if (!quote) throw Object.assign(new Error('Quote not found.'), { statusCode: 404 })
      if (quote.status !== 'draft' || quote.payments.length > 0) {
        throw conflict('Only an unpaid draft quote can be edited.')
      }
      const input = await parseQuoteInput(req.body, session, quote)
      Object.assign(quote, input)
      quote.paymentStatus = getPaymentStatus(quote.paidAmount, quote.total, quote.depositAmount)
      updated = await quote.save({ session })
    })
  } finally {
    await session.endSession()
  }
  return res.json({ success: true, data: serializeQuote(updated) })
})

export const updateQuoteStatus = asyncHandler(async (req, res) => {
  const { status } = getAllowedFields(req.body, ['status'])
  if (!quoteStatuses.includes(status)) throw badRequest('Invalid quote status.')

  const session = await mongoose.startSession()
  let updated
  try {
    await session.withTransaction(async () => {
      const quote = await findAccessibleQuote(req.params.id, req, session)
      if (!quote) throw Object.assign(new Error('Quote not found.'), { statusCode: 404 })
      if (!canTransitionQuoteStatus(quote.status, status)) {
        throw conflict(`Cannot change quote status from ${quote.status} to ${status}.`)
      }
      quote.status = status
      if (status === 'approved') {
        quote.approvedAt = new Date()
        const installments = buildRetainerInstallments(quote, quote.approvedAt)
        if (installments.length) {
          await RetainerCollection.bulkWrite(installments.map((installment) => ({
            updateOne: {
              filter: {
                quote: installment.quote,
                quoteLineItem: installment.quoteLineItem,
                installmentNumber: installment.installmentNumber,
              },
              update: { $setOnInsert: installment },
              upsert: true,
            },
          })), { session })
        }
      }
      updated = await quote.save({ session })
    })
  } finally {
    await session.endSession()
  }
  return res.json({ success: true, data: serializeQuote(updated) })
})

export const recordQuotePayment = asyncHandler(async (req, res) => {
  const idempotencyKey = parseIdempotencyKey(req.get('Idempotency-Key'))
  const body = getAllowedFields(req.body, ['amount', 'note'])
  const amount = parseMoney(body.amount, 'amount', { minimum: 0.01 })
  const note = boundedText(body.note, 'note', { max: 300 })
  const requestHash = createPaymentRequestHash({
    resourceType: 'quote',
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
        authorizeReplay: async ({ session: transaction }) => Boolean(
          await findAccessibleQuote(req.params.id, req, transaction),
        ),
        execute: async () => {
          const quote = await findAccessibleQuote(req.params.id, req, session)
          if (!quote) throw Object.assign(new Error('Quote not found.'), { statusCode: 404 })
          if (quote.status !== 'approved') throw conflict('Payments can only be recorded for approved quotes.')
          assertPaymentWithinBalance(
            quote.paidAmount,
            amount,
            quote.total,
            'The payment exceeds the outstanding quote balance.',
          )
          quote.payments.push({ amount, paidAt: new Date(), note })
          quote.paidAmount = Math.round((quote.paidAmount + amount + Number.EPSILON) * 100) / 100
          quote.paymentStatus = getPaymentStatus(quote.paidAmount, quote.total, quote.depositAmount)
          const updatedQuote = await quote.save({ session })
          return { success: true, data: serializeQuote(updatedQuote) }
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
      authorizeReplay: async () => Boolean(await findAccessibleQuote(req.params.id, req)),
    })
  }
  return res.json(responseBody)
})

export const quoteAccess = {
  async assertCanRead(user, quoteId, session) {
    const query = Quote.findById(quoteId).select('createdBy')
    if (session) query.session(session)
    const quote = await query.lean()
    if (!quote || (user.role !== 'admin' && quote.createdBy.toString() !== user.id)) return null
    return quote
  },
}

export const getQuoteOwnerIds = async (user) => (
  user.role === 'admin' ? null : Quote.find({ createdBy: user.id }).distinct('_id')
)
