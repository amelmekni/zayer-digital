import ContactMessage from '../models/ContactMessage.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getAllowedFields,
  paginationMeta,
  parseEnumFilter,
  parsePagination,
  parseSearch,
} from '../utils/apiQuery.js'

const messageStatuses = ContactMessage.schema.path('status').enumValues

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
