import mongoose from 'mongoose'
import { calculateQuote, parseMoney } from './quoteDomain.js'

const allowedFields = new Set([
  'name',
  'email',
  'company',
  'description',
  'timeline',
  'services',
  'language',
])
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const timelineOptions = new Set(['', 'asap', 'within-1-month', 'within-3-months', 'flexible'])
const MAX_QUOTE_AMOUNT = 100_000_000

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function boundedText(value, field, { min = 0, max, required = false } = {}) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length < (required ? Math.max(min, 1) : min) || text.length > max) {
    throw badRequest(`${field} must be between ${required ? Math.max(min, 1) : min} and ${max} characters.`)
  }
  return text
}

export function parsePublicQuoteRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('A quote request body is required.')
  }
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    throw badRequest('Quote requests cannot include price or quote status fields.')
  }

  const name = boundedText(body.name, 'name', { required: true, min: 2, max: 160 })
  const email = boundedText(body.email, 'email', { required: true, max: 254 })
  if (!emailPattern.test(email)) throw badRequest('email must be a valid email address.')

  if (!Array.isArray(body.services) || body.services.length < 1 || body.services.length > 20) {
    throw badRequest('Select between 1 and 20 services.')
  }
  const services = body.services.map((line) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)
      || Object.keys(line).some((key) => !['serviceId', 'quantity'].includes(key))) {
      throw badRequest('Each selected service must contain only a service ID and quantity.')
    }
    if (typeof line.serviceId !== 'string' || !mongoose.isValidObjectId(line.serviceId)) {
      throw badRequest('Each selected service must have a valid ID.')
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000) {
      throw badRequest('Each service quantity must be an integer from 1 to 1000.')
    }
    return { serviceId: line.serviceId, quantity: line.quantity }
  })
  if (new Set(services.map(({ serviceId }) => serviceId)).size !== services.length) {
    throw badRequest('A service can only be selected once.')
  }

  const timeline = boundedText(body.timeline, 'timeline', { max: 40 })
  if (!timelineOptions.has(timeline)) throw badRequest('timeline is not a supported option.')
  if (body.language !== 'fr' && body.language !== 'en') {
    throw badRequest('language must be fr or en.')
  }

  return {
    name,
    email: email.toLowerCase(),
    company: boundedText(body.company, 'company', { max: 160 }),
    description: boundedText(body.description, 'description', { required: true, min: 10, max: 5000 }),
    timeline,
    services,
    language: body.language,
  }
}

export function resolvePublicQuoteRequest(input, catalogServices) {
  if (!Array.isArray(catalogServices) || catalogServices.length !== input.services.length) {
    throw badRequest('One or more selected services are unavailable.')
  }
  const servicesById = new Map(catalogServices.map((service) => [String(service._id), service]))
  const lines = input.services.map(({ serviceId, quantity }) => {
    const service = servicesById.get(serviceId)
    if (!service || service.isActive !== true) {
      throw badRequest('One or more selected services are unavailable.')
    }
    const currency = String(service.currency || 'TND').toUpperCase()
    const hasReliablePrice = Number.isFinite(service.price) && service.price > 0
      && service.price <= MAX_QUOTE_AMOUNT && currency === 'TND'
    return {
      title: service.title,
      unit: service.unit || 'service',
      quantity,
      ...(hasReliablePrice && {
        unitPrice: parseMoney(service.price, 'service.price', { minimum: 0.01 }),
        currency,
      }),
    }
  })
  const hasReliablePrices = lines.every((line) => Number.isFinite(line.unitPrice))
  const amount = hasReliablePrices
    ? lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
    : Number.POSITIVE_INFINITY
  const total = hasReliablePrices && Number.isFinite(amount) && amount <= MAX_QUOTE_AMOUNT
    ? calculateQuote(lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      monthlyPrice: 0,
    }))).total
    : null

  return {
    lines,
    currency: total === null ? null : 'TND',
    total,
  }
}

export function formatPublicQuoteMessage(input, resolved) {
  const copy = input.language === 'fr'
    ? {
      request: 'Demande de devis gratuit',
      services: 'Services sélectionnés',
      quantity: 'Quantité',
      timeline: 'Délai souhaité',
      description: 'Besoin décrit par le client',
      estimate: 'Estimation indicative vérifiée par le serveur',
      pending: 'Tarification à confirmer par l’équipe ZAYER Digital.',
      none: 'Non précisé',
      notOfficial: 'ne constitue pas un devis officiel',
    }
    : {
      request: 'Free quote request',
      services: 'Selected services',
      quantity: 'Quantity',
      timeline: 'Desired timeline',
      description: 'Customer brief',
      estimate: 'Indicative estimate verified by the server',
      pending: 'Pricing to be confirmed by the ZAYER Digital team.',
      none: 'Not specified',
      notOfficial: 'not an official quote',
    }
  const serviceList = resolved.lines
    .map((line) => `- ${line.title} (${copy.quantity}: ${line.quantity})`)
    .join('\n')
  const estimate = resolved.total === null
    ? copy.pending
    : `${copy.estimate}: ${resolved.total.toFixed(2)} ${resolved.currency} (${copy.notOfficial})`

  return [
    copy.request,
    `${copy.description}: ${input.description}`,
    `${copy.timeline}: ${input.timeline || copy.none}`,
    `${copy.services}:\n${serviceList}`,
    estimate,
  ].join('\n\n')
}
