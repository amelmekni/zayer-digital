import mongoose from 'mongoose'

const collectionName = 'admin_account_guards'
const guardId = 'admin-account-mutations'

function getGuardCollection() {
  if (!mongoose.connection.db) {
    throw new Error('The MongoDB connection is not ready for administrator safeguards.')
  }
  return mongoose.connection.db.collection(collectionName)
}

export async function initializeAdminAccountGuard() {
  const database = mongoose.connection.db
  if (!database) {
    throw new Error('The MongoDB connection is not ready for administrator safeguards.')
  }

  try {
    await database.createCollection(collectionName)
  } catch (error) {
    if (error.code !== 48) throw error
  }

  const collection = getGuardCollection()
  try {
    await collection.insertOne({ _id: guardId, revision: 0 })
  } catch (error) {
    if (error.code !== 11000) throw error
    const guard = await collection.findOne({ _id: guardId })
    if (!guard) throw error
  }

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const result = await collection.updateOne(
        { _id: guardId },
        { $inc: { revision: 1 } },
        { session },
      )
      if (result.matchedCount !== 1) {
        throw new Error('The administrator safeguard record could not be initialized.')
      }
    })
  } catch (error) {
    if (error.message === 'The administrator safeguard record could not be initialized.') {
      throw error
    }
    const diagnostic = error.codeName || error.code || error.name
    throw new Error(
      `MongoDB transaction support could not be verified${diagnostic ? ` (${diagnostic})` : ''}. A replica set or sharded cluster is required for administrator safeguards.`,
    )
  } finally {
    await session.endSession()
  }
}

export async function withAdminAccountGuard(operation) {
  const collection = getGuardCollection()
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      const result = await collection.updateOne(
        { _id: guardId },
        { $inc: { revision: 1 } },
        { session },
      )
      if (result.matchedCount !== 1) {
        throw new Error('The administrator safeguard record has not been initialized.')
      }
      return operation(session)
    })
  } finally {
    await session.endSession()
  }
}
