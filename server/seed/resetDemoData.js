import mongoose from 'mongoose'
import { pathToFileURL } from 'node:url'
import Application from '../models/Application.js'
import ContactMessage from '../models/ContactMessage.js'
import Job from '../models/Job.js'
import Project from '../models/Project.js'
import Quote from '../models/Quote.js'
import RetainerCollection from '../models/RetainerCollection.js'
import Service from '../models/Service.js'
import User from '../models/User.js'
import { connectToDemoDatabase } from './demoDatabase.js'
import {
  createDemoDocuments,
  DEMO_EMAILS,
  DEMO_IDS,
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

export async function resetDemoData() {
  await connectToDemoDatabase(mongoose)
  const session = await mongoose.startSession()
  try {
    const data = createDemoDocuments('demo-seed-reset-placeholder')
    await session.withTransaction(async () => {
      for (const { collection, record, identity } of demoRecordIdentities(data)) {
        const Model = models[collection]
        const existing = await Model.findById(record._id).session(session).lean()
        if (existing && identity.some((field) => !sameId(existing[field], record[field]))) {
          throw new Error(`Demo reset stopped: reserved ${collection} ID is occupied by different data.`)
        }
      }

      for (const [collection, ids] of Object.entries({
        RetainerCollection: DEMO_IDS.collections,
        Quote: Object.values(DEMO_IDS.quotes),
        ContactMessage: [DEMO_IDS.contact],
        Application: [DEMO_IDS.application],
        Job: [DEMO_IDS.job],
        Project: Object.values(DEMO_IDS.projects),
        Service: Object.values(DEMO_IDS.services),
        User: Object.values(DEMO_IDS.users),
      })) {
        await models[collection].deleteMany({ _id: { $in: ids } }, { session })
      }

      for (const [role, email] of Object.entries(DEMO_EMAILS)) {
        const existing = await User.findOne({ email }).select('_id').session(session).lean()
        if (existing) {
          throw new Error(`Demo reset stopped: reserved ${role} email remains in use.`)
        }
      }
    })
    console.info('Only the reserved fictional demo records were removed. User-created records were preserved.')
    return { reset: true }
  } finally {
    await session.endSession()
    await mongoose.disconnect()
  }
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectExecution) {
  resetDemoData().catch((error) => {
    console.error(`Demo reset failed: ${error.message}`)
    process.exitCode = 1
  })
}
