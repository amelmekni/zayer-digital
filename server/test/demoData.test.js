import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import test from 'node:test'
import Application from '../models/Application.js'
import ContactMessage from '../models/ContactMessage.js'
import Job from '../models/Job.js'
import Project from '../models/Project.js'
import Quote from '../models/Quote.js'
import RetainerCollection from '../models/RetainerCollection.js'
import Service from '../models/Service.js'
import User from '../models/User.js'
import { createDemoDocuments, DEMO_PASSWORD } from '../seed/demoData.js'

const models = {
  users: User,
  services: Service,
  projects: Project,
  jobs: Job,
  applications: Application,
  contacts: ContactMessage,
  quotes: Quote,
  collections: RetainerCollection,
}

test('all fictional demo fixtures validate against their current Mongoose schemas', async () => {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 4)
  const fixtures = createDemoDocuments(passwordHash)

  for (const [collection, documents] of Object.entries(fixtures)) {
    const Model = models[collection]
    assert.ok(Model, `Unexpected fixture collection: ${collection}`)
    for (const document of documents) {
      await assert.doesNotReject(
        new Model(document).validate(),
        `${collection} fixture ${document._id}`,
      )
    }
  }
})
