import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteUser, updateUser } from '../controllers/userController.js'
import { createUserAccountMutations } from '../utils/userAccountMutations.js'

function invokeHandler(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      status(statusCode) {
        this.statusCode = statusCode
        return this
      },
      json(body) {
        resolve({ statusCode: this.statusCode || 200, body })
        return this
      },
    }
    handler(req, res, reject)
  })
}

function createFixture(initialUsers) {
  const records = new Map(initialUsers.map((user) => [user.id, { ...user }]))
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
    users: {
      async findRoleById(id) {
        const user = records.get(id)
        return user ? { role: user.role } : null
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

test('rejects administrator self-deletion and self-demotion before opening a guarded mutation', async () => {
  const { mutations, getGuardedOperations } = createFixture(admins)

  assert.deepEqual(await mutations.delete({ actorId: 'admin-a', targetId: 'admin-a' }), {
    kind: 'self-deletion',
  })
  assert.deepEqual(await mutations.update({
    actorId: 'admin-a',
    targetId: 'admin-a',
    update: { role: 'user' },
  }), { kind: 'self-demotion' })
  assert.equal(getGuardedOperations(), 0)
})

test('returns the API conflict response for self-deletion and self-demotion', async () => {
  const request = {
    params: { id: 'admin-a' },
    user: { id: 'admin-a', role: 'admin' },
  }
  const deleted = await invokeHandler(deleteUser, request)
  const demoted = await invokeHandler(updateUser, { ...request, body: { role: 'user' } })

  assert.equal(deleted.statusCode, 409)
  assert.deepEqual(deleted.body, {
    success: false,
    error: { message: 'Administrators cannot delete their own account.' },
  })
  assert.equal(demoted.statusCode, 409)
  assert.deepEqual(demoted.body, {
    success: false,
    error: { message: 'Administrators cannot demote their own account.' },
  })
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
  assert.equal(records.get('admin-a').role, 'admin')
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

test('serializes competing deletion and demotion attempts so a final administrator remains', async () => {
  const { mutations, records } = createFixture(admins)
  const results = await Promise.all([
    mutations.delete({ actorId: 'admin-a', targetId: 'admin-b' }),
    mutations.update({
      actorId: 'admin-b',
      targetId: 'admin-a',
      update: { role: 'user' },
    }),
  ])

  assert.equal(results.filter((result) => result.kind === 'deleted' || result.kind === 'updated').length, 1)
  assert.equal(results.filter((result) => result.kind === 'last-admin').length, 1)
  assert.equal([...records.values()].filter((user) => user.role === 'admin').length, 1)
})
