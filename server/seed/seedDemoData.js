import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { pathToFileURL } from 'node:url'
import Application from '../models/Application.js'
import ContactMessage from '../models/ContactMessage.js'
import Job from '../models/Job.js'
import Project from '../models/Project.js'
import Quote from '../models/Quote.js'
import QuoteSequence from '../models/QuoteSequence.js'
import RetainerCollection from '../models/RetainerCollection.js'
import Service from '../models/Service.js'
import User from '../models/User.js'
import { connectToDemoDatabase } from './demoDatabase.js'
import {
  createDemoDocuments,
  DEMO_PASSWORD,
  demoRecordIdentities,
} from './demoData.js'

const models = {
  User,
  Service,
  Project,
  Job,
  Application,
  ContactMessage,
  Quote,
  RetainerCollection,
}

function sameId(left, right) {
  return String(left) === String(right)
}

async function assertNoIdentityCollisions(data, session) {
  for (const { collection, record, unique, identity } of demoRecordIdentities(data)) {
    const Model = models[collection]
    const byId = await Model.findById(record._id).session(session).lean()
    const byUniqueKey = unique
      ? await Model.findOne(unique).select('_id').session(session).lean()
      : null

    if (byUniqueKey && !sameId(byUniqueKey._id, record._id)) {
      throw new Error(`Demo seed stopped: a non-demo ${collection} already uses a reserved unique value.`)
    }
    if (byId && identity.some((field) => !sameId(byId[field], record[field]))) {
      throw new Error(`Demo seed stopped: reserved ${collection} ID is occupied by different data.`)
    }
  }
}

async function upsertDemoDocuments(data, session) {
  await assertNoIdentityCollisions(data, session)
  for (const [collection, records] of Object.entries(data)) {
    if (!models[collection]) continue
    const Model = models[collection]
    for (const record of records) {
      const { _id, ...fields } = record
      await Model.updateOne(
        { _id },
        { $set: fields },
        { upsert: true, runValidators: true, session, setDefaultsOnInsert: true },
      )
    }
  }

  await QuoteSequence.updateOne(
    { _id: 'quote' },
    { $max: { value: 900002 } },
    { upsert: true, session, setDefaultsOnInsert: true },
  )
}

export async function seedDemoData() {
  await connectToDemoDatabase(mongoose)
  const session = await mongoose.startSession()
  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
    const data = createDemoDocuments(passwordHash)
    await session.withTransaction(async () => upsertDemoDocuments(data, session))
    console.info('Fictional ZAYER demo records seeded in the verified local test database.')
    return { seeded: true }
  } finally {
    await session.endSession()
    await mongoose.disconnect()
  }
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectExecution) {
  seedDemoData().catch((error) => {
    console.error(`Demo seed failed: ${error.message}`)
    process.exitCode = 1
  })
}
