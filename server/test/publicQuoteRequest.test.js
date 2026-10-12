import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatPublicQuoteMessage,
  parsePublicQuoteRequest,
  resolvePublicQuoteRequest,
} from '../utils/publicQuoteRequest.js'

const validInput = {
  name: 'A Client',
  email: 'CLIENT@example.com',
  company: '',
  description: 'A new website and digital strategy.',
  timeline: 'within-1-month',
  services: [{ serviceId: '507f1f77bcf86cd799439011', quantity: 2 }],
  language: 'en',
}

test('validates public quote request contact data and normalizes email', () => {
  assert.equal(parsePublicQuoteRequest(validInput).email, 'client@example.com')
  for (const body of [
    { ...validInput, name: 'A' },
    { ...validInput, email: 'bad-email' },
    { ...validInput, description: 'too short' },
    { ...validInput, services: [{ serviceId: 'not-an-id', quantity: 1 }] },
    { ...validInput, services: [{ serviceId: '507f1f77bcf86cd799439011', quantity: 0 }] },
    { ...validInput, services: [validInput.services[0], validInput.services[0]] },
    { ...validInput, total: 1 },
  ]) {
    assert.throws(() => parsePublicQuoteRequest(body), (error) => error.statusCode === 400)
  }
})

test('rebuilds an estimate only from active server catalog prices in TND', () => {
  const input = parsePublicQuoteRequest(validInput)
  const resolved = resolvePublicQuoteRequest(input, [{
    _id: '507f1f77bcf86cd799439011',
    title: 'Web design',
    unit: 'project',
    price: 125,
    currency: 'TND',
    isActive: true,
  }])
  assert.deepEqual(resolved, {
    lines: [{ title: 'Web design', unit: 'project', quantity: 2, unitPrice: 125, currency: 'TND' }],
    currency: 'TND',
    total: 250,
  })
})

test('requires custom pricing confirmation when a price is missing, zero, or not TND', () => {
  const input = parsePublicQuoteRequest(validInput)
  for (const service of [
    { price: undefined, currency: 'TND' },
    { price: 0, currency: 'TND' },
    { price: 200, currency: 'EUR' },
  ]) {
    const resolved = resolvePublicQuoteRequest(input, [{
      _id: input.services[0].serviceId,
      title: 'Service',
      isActive: true,
      ...service,
    }])
    assert.equal(resolved.total, null)
    assert.equal(resolved.currency, null)
  }
})

test('rejects catalog omissions/inactive services and formats a clear non-official request', () => {
  const input = parsePublicQuoteRequest(validInput)
  assert.throws(() => resolvePublicQuoteRequest(input, []), (error) => error.statusCode === 400)
  assert.throws(() => resolvePublicQuoteRequest(input, [{
    _id: input.services[0].serviceId,
    title: 'Inactive',
    isActive: false,
  }]), (error) => error.statusCode === 400)

  const resolved = resolvePublicQuoteRequest(input, [{
    _id: input.services[0].serviceId,
    title: 'Web design',
    price: 125,
    currency: 'TND',
    isActive: true,
  }])
  const message = formatPublicQuoteMessage(input, resolved)
  assert.match(message, /250\.00 TND/)
  assert.match(message, /not an official quote/)
})
