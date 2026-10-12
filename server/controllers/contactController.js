import ContactMessage from '../models/ContactMessage.js'
import Service from '../models/Service.js'
import PDFDocument from 'pdfkit'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  formatPublicQuoteMessage,
  parsePublicQuoteRequest,
  resolvePublicQuoteRequest,
} from '../utils/publicQuoteRequest.js'
import { pdfSafeText } from '../utils/pdfText.js'
import {
  getAllowedFields,
  paginationMeta,
  parseEnumFilter,
  parsePagination,
  parseSearch,
} from '../utils/apiQuery.js'

const messageStatuses = ContactMessage.schema.path('status').enumValues
const quotePdfCopy = {
  en: {
    title: 'Indicative quote estimate',
    warning: 'This is an estimate only, not an official quote. Final scope and pricing will be confirmed by our team.',
    client: 'Prepared for',
    date: 'Prepared on',
    brief: 'Your project brief',
    timeline: 'Desired timeline',
    services: 'Selected services',
    quantity: 'Quantity',
    pricePending: 'Price to be confirmed',
    total: 'Indicative total',
    pending: 'Pricing will be confirmed by the ZAYER Digital team.',
    notSpecified: 'Not specified',
  },
  fr: {
    title: 'Estimation indicative de devis',
    warning: 'Cette estimation ne constitue pas un devis officiel. Notre équipe confirmera le périmètre et le tarif final.',
    client: 'Préparé pour',
    date: 'Préparé le',
    brief: 'Description de votre besoin',
    timeline: 'Délai souhaité',
    services: 'Services sélectionnés',
    quantity: 'Quantité',
    pricePending: 'Tarif à confirmer',
    total: 'Total indicatif',
    pending: 'Le tarif sera confirmé par l’équipe ZAYER Digital.',
    notSpecified: 'Non précisé',
  },
}

async function resolveQuoteRequest(body) {
  const input = parsePublicQuoteRequest(body)
  const catalogServices = await Service.find({
    _id: { $in: input.services.map(({ serviceId }) => serviceId) },
    isActive: true,
  }).lean()
  return { input, resolved: resolvePublicQuoteRequest(input, catalogServices) }
}

export const createPublicQuoteRequest = asyncHandler(async (req, res) => {
  const { input, resolved } = await resolveQuoteRequest(req.body)
  const contactMessage = await ContactMessage.create({
    name: input.name,
    email: input.email,
    ...(input.company && { company: input.company }),
    subject: 'Public quote request',
    message: formatPublicQuoteMessage(input, resolved),
  })
  return res.status(201).json({
    success: true,
    data: {
      id: contactMessage._id,
      officialQuoteCreated: false,
      total: resolved.total,
      currency: resolved.currency,
    },
  })
})

export const downloadPublicQuoteRequestPdf = asyncHandler(async (req, res) => {
  const { input, resolved } = await resolveQuoteRequest(req.body)
  const copy = quotePdfCopy[input.language]
  const date = new Intl.DateTimeFormat(input.language === 'fr' ? 'fr-TN' : 'en-TN', {
    dateStyle: 'long',
  }).format(new Date())

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="ZAYER-estimate-${new Date().toISOString().slice(0, 10)}.pdf"`)
  res.setHeader('Cache-Control', 'no-store')
  const document = new PDFDocument({ size: 'A4', margin: 48 })
  document.on('error', (error) => {
    if (!res.headersSent) res.status(500).end()
    else res.destroy(error)
  })
  document.pipe(res)
  document.fillColor('#0a1628').font('Helvetica-Bold').fontSize(21).text('ZAYER Digital')
  document.moveDown(0.35)
  document.fontSize(15).text(copy.title)
  document.moveDown(0.4)
  document.fillColor('#725b32').font('Helvetica-Bold').fontSize(9).text(copy.warning)
  document.moveDown()
  document.fillColor('#0a1628').font('Helvetica-Bold').fontSize(10).text(`${copy.client}: ${pdfSafeText(input.name)}`)
  document.font('Helvetica').text(`${copy.date}: ${pdfSafeText(date)}`)
  if (input.company) document.text(pdfSafeText(input.company))
  document.text(pdfSafeText(input.email))
  document.moveDown()
  document.font('Helvetica-Bold').text(copy.brief)
  document.font('Helvetica').text(pdfSafeText(input.description), { width: 500 })
  document.moveDown(0.5)
  document.font('Helvetica-Bold').text(copy.timeline)
  document.font('Helvetica').text(pdfSafeText(input.timeline || copy.notSpecified))
  document.moveDown()
  document.font('Helvetica-Bold').text(copy.services)
  document.moveDown(0.25)
  for (const line of resolved.lines) {
    const lineTotal = line.unitPrice === undefined
      ? copy.pricePending
      : `${(line.unitPrice * line.quantity).toFixed(2)} ${line.currency}`
    document.font('Helvetica-Bold').fontSize(10)
      .text(pdfSafeText(line.title), { continued: true })
    document.font('Helvetica').text(`  |  ${copy.quantity}: ${line.quantity} ${pdfSafeText(line.unit)}  |  ${lineTotal}`)
    document.moveDown(0.35)
  }
  if (resolved.total === null) {
    document.moveDown(0.5)
    document.font('Helvetica-Bold').text(copy.pending)
  } else {
    document.moveDown(0.5)
    document.font('Helvetica-Bold').fontSize(12)
      .text(`${copy.total}: ${resolved.total.toFixed(2)} ${resolved.currency}`)
  }
  document.end()
})

export const createContactMessage = asyncHandler(async (req, res) => {
  const body = getAllowedFields(req.body, ['name', 'email', 'phone', 'company', 'subject', 'message'])
  const contactMessage = await ContactMessage.create(body)
  return res.status(201).json({ success: true, data: contactMessage })
})

export const getContactMessages = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query)
  const filter = {}
  const status = parseEnumFilter(req.query.status, messageStatuses, 'status')

  if (status) filter.status = status
  const search = parseSearch(req.query.search)
  if (search) {
    filter.$or = [{ name: search }, { email: search }, { subject: search }, { message: search }]
  }

  const [messages, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ContactMessage.countDocuments(filter),
  ])

  res.json({
    success: true,
    data: messages,
    meta: { pagination: paginationMeta(page, limit, total) },
  })
})

export const getContactMessageById = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findById(req.params.id).lean()
  if (!message) {
    return res.status(404).json({ success: false, error: { message: 'Contact message not found.' } })
  }
  return res.json({ success: true, data: message })
})

export const updateContactMessage = asyncHandler(async (req, res) => {
  const update = getAllowedFields(req.body, ['status'])
  const message = await ContactMessage.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  })

  if (!message) {
    return res.status(404).json({ success: false, error: { message: 'Contact message not found.' } })
  }
  return res.json({ success: true, data: message })
})
