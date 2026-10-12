import assert from 'node:assert/strict'
import test from 'node:test'
import { isTokenVersionCurrent } from '../utils/tokenVersion.js'

test('a role-change tokenVersion increment invalidates existing tokens', () => {
  const tokenVersionAtIssue = 4
  const tokenVersionAfterRoleChange = tokenVersionAtIssue + 1

  assert.equal(isTokenVersionCurrent(tokenVersionAtIssue, tokenVersionAfterRoleChange), false)
  assert.equal(isTokenVersionCurrent(tokenVersionAfterRoleChange, tokenVersionAfterRoleChange), true)
})

test('preserves compatibility for tokens and users without an explicit version', () => {
  assert.equal(isTokenVersionCurrent(undefined, 0), true)
  assert.equal(isTokenVersionCurrent(0, undefined), true)
})
