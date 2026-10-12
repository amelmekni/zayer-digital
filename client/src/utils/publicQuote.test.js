import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateIndicativeTotal,
  publicQuotePayload,
  validatePublicQuoteForm,
} from './publicQuote.js'

const knownService = { _id: '507f1f77bcf86cd799439011', price: 125, currency: 'TND' }
const validForm = {
  name: 'A Client',
  email: 'client@example.com',
  company: '',
  description: 'A new website and digital strategy.',
  timeline: 'within-1-month',
}

test('calculates a TND estimate from configured catalog prices and quantities', () => {
  assert.equal(calculateIndicativeTotal([
    { service: knownService, quantity: 2 },
    { service: { price: 20.25, currency: 'tnd' }, quantity: 1 },
  ]), 270.25)
})

test('does not show a real amount for an empty or incomplete catalog', () => {
  assert.equal(calculateIndicativeTotal([]), null)
  assert.equal(calculateIndicativeTotal([{ service: knownService, quantity: 1 }]), 125)
  assert.equal(calculateIndicativeTotal([{ service: { currency: 'TND' }, quantity: 1 }]), null)
  assert.equal(calculateIndicativeTotal([{ service: { price: 0, currency: 'TND' }, quantity: 1 }]), null)
  assert.equal(calculateIndicativeTotal([{ service: { price: 10, currency: 'EUR' }, quantity: 1 }]), null)
})

test('validates quote form fields, selected services, and quantities', () => {
  assert.equal(validatePublicQuoteForm(validForm, [{ service: knownService, quantity: 1 }]), '')
  assert.equal(validatePublicQuoteForm(validForm, []), 'chooseService')
  assert.equal(validatePublicQuoteForm({ ...validForm, name: 'A' }, [{ service: knownService, quantity: 1 }]), 'invalidName')
  assert.equal(validatePublicQuoteForm({ ...validForm, email: 'bad' }, [{ service: knownService, quantity: 1 }]), 'invalidEmail')
  assert.equal(validatePublicQuoteForm({ ...validForm, description: 'short' }, [{ service: knownService, quantity: 1 }]), 'shortDescription')
  assert.equal(validatePublicQuoteForm(validForm, [{ service: knownService, quantity: 0 }]), 'invalidQuantity')
})

test('sends only selected service IDs and quantities, never browser-calculated prices', () => {
  const payload = publicQuotePayload(validForm, [{ service: knownService, quantity: 3 }], 'fr')
  assert.deepEqual(payload.services, [{ serviceId: knownService._id, quantity: 3 }])
  assert.equal(Object.hasOwn(payload, 'total'), false)
  assert.equal(Object.hasOwn(payload.services[0], 'price'), false)
})
