import 'dotenv/config'
import {
  assertLocalReplicaSet,
  validateDemoSeedTarget,
} from '../utils/demoSeedSafety.js'

export async function connectToDemoDatabase(mongoose) {
  const target = validateDemoSeedTarget({
    nodeEnv: process.env.NODE_ENV,
    mongoUri: process.env.MONGO_URI,
    seedEnabled: process.env.ZAYER_DEMO_SEED,
  })
  const uri = new URL(target.mongoUri)
  const port = Number(uri.port || 27017)

  await mongoose.connect(target.mongoUri, { serverSelectionTimeoutMS: 5000 })
  if (mongoose.connection.name !== target.databaseName) {
    await mongoose.disconnect()
    throw new Error('Connected database name did not match the dedicated demo database.')
  }

  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 })
    assertLocalReplicaSet(hello, { host: uri.hostname, port })
  } catch (error) {
    await mongoose.disconnect()
    throw error
  }

  return target
}
