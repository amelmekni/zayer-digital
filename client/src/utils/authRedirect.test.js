import assert from 'node:assert/strict'
import test from 'node:test'
import { loginAndGetDestination } from './authRedirect.js'

test('redirects administrators and sales agents to the protected dashboard', async () => {
  for (const role of ['admin', 'sales_agent']) {
    assert.equal(
      await loginAndGetDestination(async () => ({ role }), {}),
      '/dashboard',
    )
  }
})

test('returns a requested protected destination when present', async () => {
  assert.equal(
    await loginAndGetDestination(async () => ({ role: 'admin' }), {}, '/dashboard/quotes'),
    '/dashboard/quotes',
  )
})

test('redirects a regular user to the public home page', async () => {
  assert.equal(await loginAndGetDestination(async () => ({ role: 'user' }), {}), '/')
})

test('does not produce a destination when authentication fails', async () => {
  const login = async () => { throw new Error('Invalid credentials') }
  await assert.rejects(loginAndGetDestination(login, {}), /Invalid credentials/)
})
