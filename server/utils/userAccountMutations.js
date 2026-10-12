export function createUserAccountMutations({ users, quotes, withGuard }) {
  return {
    async update({ actorId, targetId, update }) {
      return withGuard(async (session) => {
        const target = await users.findRoleById(targetId, session)
        if (!target) return { kind: 'not-found' }

        const roleChanged = update.role !== undefined && update.role !== target.role
        if (target.role === 'admin' && roleChanged && actorId === targetId) {
          return { kind: 'self-demotion' }
        }

        if (target.role === 'admin' && roleChanged && update.role !== 'admin') {
          const administratorCount = await users.countAdmins(session)
          if (administratorCount <= 1) return { kind: 'last-admin' }
        }

        const accountUpdate = roleChanged
          ? { ...update, tokenVersion: (target.tokenVersion || 0) + 1 }
          : update
        const user = await users.updateById(targetId, accountUpdate, session)
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

        if (await quotes.hasOwnedQuotes(targetId, session)) return { kind: 'has-quotes' }

        const user = await users.deleteById(targetId, session)
        return user ? { kind: 'deleted', user } : { kind: 'not-found' }
      })
    },
  }
}
