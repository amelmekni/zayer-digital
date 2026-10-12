export function calculateIndicativeTotal(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return null
  let total = 0
  for (const { service, quantity } of lines) {
    const price = Number(service?.price)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000
      || !Number.isFinite(price) || price <= 0
      || String(service?.currency || 'TND').toUpperCase() !== 'TND') {
      return null
    }
    total += price * quantity
    if (!Number.isFinite(total) || total > 100_000_000) return null
  }
  return Math.round((total + Number.EPSILON) * 100) / 100
}

export function validatePublicQuoteForm(form, lines) {
  if (!Array.isArray(lines) || lines.length === 0) return 'chooseService'
  if (String(form.name || '').trim().length < 2) return 'invalidName'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email || '').trim())) return 'invalidEmail'
  if (String(form.company || '').trim().length > 160) return 'invalidCompany'
  if (String(form.description || '').trim().length < 10) return 'shortDescription'
  if (String(form.description || '').trim().length > 5000) return 'longDescription'
  if (!['', 'asap', 'within-1-month', 'within-3-months', 'flexible'].includes(form.timeline)) {
    return 'invalidTimeline'
  }
  if (lines.some(({ quantity }) => !Number.isInteger(quantity) || quantity < 1 || quantity > 1000)) {
    return 'invalidQuantity'
  }
  return ''
}

export function publicQuotePayload(form, lines, language) {
  return {
    name: String(form.name).trim(),
    email: String(form.email).trim(),
    company: String(form.company || '').trim(),
    description: String(form.description).trim(),
    timeline: form.timeline || '',
    services: lines.map(({ service, quantity }) => ({
      serviceId: service._id,
      quantity,
    })),
    language,
  }
}
