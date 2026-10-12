import assert from 'node:assert/strict'
import test from 'node:test'
import { createUserAccountMutations } from '../utils/userAccountMutations.js'

function createFixture(initialUsers, quoteOwners = []) {
  const records = new Map(initialUsers.map((user) => [
    user.id,
    { tokenVersion: 0, ...user },
  ]))
  const quoteOwnerIds = new Set(quoteOwners)
  let tail = Promise.resolve()
  let guardedOperations = 0

  const withGuard = async (operation) => {
    const previous = tail
    let release
    tail = new Promise((resolve) => {
      release = resolve
    })
    await previous
    guardedOperations += 1
    try {
      return await operation({})
    } finally {
      release()
    }
  }

  const mutations = createUserAccountMutations({
    withGuard,
    quotes: {
      async hasOwnedQuotes(id) {
        return quoteOwnerIds.has(id)
      },
    },
    users: {
      async findRoleById(id) {
        const user = records.get(id)
        return user ? { role: user.role, tokenVersion: user.tokenVersion } : null
      },
      async countAdmins() {
        return [...records.values()].filter((user) => user.role === 'admin').length
      },
      async updateById(id, update) {
        const user = records.get(id)
        if (!user) return null
        Object.assign(user, update)
        return { ...user }
      },
      async deleteById(id) {
        const user = records.get(id)
        if (!user) return null
        records.delete(id)
        return { ...user }
      },
    },
  })

  return { records, mutations, getGuardedOperations: () => guardedOperations }
}

const admins = [
  { id: 'admin-a', role: 'admin' },
  { id: 'admin-b', role: 'admin' },
]

test('rejects administrator self-deletion and self-demotion within the account guard', async () => {
  const { mutations, getGuardedOperations } = createFixture(admins)

  assert.deepEqual(await mutations.delete({ actorId: 'admin-a', targetId: 'admin-a' }), {
    kind: 'self-deletion',
  })
  assert.deepEqual(await mutations.update({
    actorId: 'admin-a',
    targetId: 'admin-a',
    update: { role: 'user' },
  }), { kind: 'self-demotion' })
  assert.deepEqual(await mutations.update({
    actorId: 'admin-a',
    targetId: 'admin-a',
    update: { role: 'sales_agent' },
  }), { kind: 'self-demotion' })
  assert.equal(getGuardedOperations(), 2)
})

test('rejects deleting or demoting the only administrator', async () => {
  const { mutations, records } = createFixture([{ id: 'admin-a', role: 'admin' }])

  assert.deepEqual(await mutations.delete({ actorId: 'other-admin', targetId: 'admin-a' }), {
    kind: 'last-admin',
  })
  assert.deepEqual(await mutations.update({
    actorId: 'other-admin',
    targetId: 'admin-a',
    update: { role: 'user' },
  }), { kind: 'last-admin' })
  assert.deepEqual(await mutations.update({
    actorId: 'other-admin',
    targetId: 'admin-a',
    update: { role: 'sales_agent' },
  }), { kind: 'last-admin' })
  assert.equal(records.get('admin-a').role, 'admin')
})

test('allows an administrator role change when another administrator remains', async () => {
  const { mutations, records } = createFixture(admins)

  const result = await mutations.update({
    actorId: 'admin-b',
    targetId: 'admin-a',
    update: { role: 'sales_agent' },
  })

  assert.equal(result.kind, 'updated')
  assert.equal(records.get('admin-a').role, 'sales_agent')
  assert.equal([...records.values()].filter((user) => user.role === 'admin').length, 1)
})

test('increments tokenVersion only when the role changes', async () => {
  const { mutations, records } = createFixture([
    ...admins,
    { id: 'agent-a', role: 'sales_agent', tokenVersion: 4 },
  ])

  await mutations.update({
    actorId: 'admin-a',
    targetId: 'agent-a',
    update: { role: 'user' },
  })
  assert.equal(records.get('agent-a').tokenVersion, 5)

  await mutations.update({
    actorId: 'admin-a',
    targetId: 'agent-a',
    update: { role: 'user' },
  })
  assert.equal(records.get('agent-a').tokenVersion, 5)
})

test('allows safe deletion and demotion when multiple administrators exist', async () => {
  const { mutations, records } = createFixture([
    ...admins,
    { id: 'admin-c', role: 'admin' },
  ])

  assert.equal((await mutations.update({
    actorId: 'admin-a',
    targetId: 'admin-b',
    update: { role: 'user' },
  })).kind, 'updated')
  assert.equal((await mutations.delete({
    actorId: 'admin-a',
    targetId: 'admin-c',
  })).kind, 'deleted')
  assert.equal([...records.values()].filter((user) => user.role === 'admin').length, 1)
})

test('blocks deletion of a user who owns quotes and preserves the account', async () => {
  const { mutations, records } = createFixture([
    ...admins,
    { id: 'agent-a', role: 'sales_agent' },
  ], ['agent-a'])

  assert.deepEqual(await mutations.delete({
    actorId: 'admin-a',
    targetId: 'agent-a',
  }), { kind: 'has-quotes' })
  assert.equal(records.get('agent-a').role, 'sales_agent')
})

test('serializes competing deletion and demotion attempts so a final administrator remains', async () => {
  const { mutations, records } = createFixture(admins)
  const results = await Promise.all([
    mutations.update({
      actorId: 'admin-b',
      targetId: 'admin-a',
      update: { role: 'sales_agent' },
    }),
    mutations.update({
      actorId: 'admin-a',
      targetId: 'admin-b',
      update: { role: 'user' },
    }),
  ])

  assert.equal(results.filter((result) => result.kind === 'updated').length, 1)
  assert.equal(results.filter((result) => result.kind === 'last-admin').length, 1)
  assert.equal([...records.values()].filter((user) => user.role === 'admin').length, 1)
})
