export function createUserAccountMutations({ users, withGuard }) {
  return {
    async update({ actorId, targetId, update }) {
      if (actorId === targetId && update.role === 'user') {
        return { kind: 'self-demotion' }
      }

      return withGuard(async (session) => {
        const target = await users.findRoleById(targetId, session)
        if (!target) return { kind: 'not-found' }

        if (target.role === 'admin' && update.role === 'user') {
          const administratorCount = await users.countAdmins(session)
          if (administratorCount <= 1) return { kind: 'last-admin' }
        }

        const user = await users.updateById(targetId, update, session)
        return user ? { kind: 'updated', user } : { kind: 'not-found' }
      })
    },

    async delete({ actorId, targetId }) {
      if (actorId === targetId) return { kind: 'self-deletion' }

      return withGuard(async (session) => {
        const target = await users.findRoleById(targetId, session)
        if (!target) return { kind: 'not-found' }

        if (target.role === 'admin') {
          const administratorCount = await users.countAdmins(session)
          if (administratorCount <= 1) return { kind: 'last-admin' }
        }

        const user = await users.deleteById(targetId, session)
        return user ? { kind: 'deleted', user } : { kind: 'not-found' }
      })
    },
  }
}
