import assert from 'node:assert/strict'
import test from 'node:test'
import { requireSalesRole } from '../middleware/salesMiddleware.js'

function runMiddleware(user) {
  const result = { next: false, status: null, body: null }
  const req = { user }
  const res = {
    status(code) {
      result.status = code
      return this
    },
    json(body) {
      result.body = body
      return this
    },
  }

  requireSalesRole(req, res, () => { result.next = true })
  return result
}

test('allows only authenticated administrators and sales agents', () => {
  assert.equal(runMiddleware({ role: 'admin' }).next, true)
  assert.equal(runMiddleware({ role: 'sales_agent' }).next, true)

  const userDenied = runMiddleware({ role: 'user' })
  assert.equal(userDenied.status, 403)
  assert.equal(userDenied.body.success, false)

  const anonymousDenied = runMiddleware(null)
  assert.equal(anonymousDenied.status, 401)
  assert.equal(anonymousDenied.body.success, false)
})
