import { pathToFileURL } from 'node:url'
import { connectDB } from '../config/db.js'
import Service from '../models/Service.js'
import { officialServices } from './officialServices.js'

export async function syncOfficialServices() {
  await connectDB()
  try {
    const result = await Service.bulkWrite(officialServices.map(({ slug, ...content }) => ({
      updateOne: {
        filter: { slug },
        update: {
          $set: {
            ...content,
            shortDescription: content.description,
            isActive: true,
          },
          $setOnInsert: { slug },
        },
        upsert: true,
      },
    })))

    console.info(`Official service content synchronized (${result.upsertedCount} inserted, ${result.modifiedCount} updated).`)
    return result
  } finally {
    await Service.db.close()
  }
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectExecution) {
  syncOfficialServices().catch((error) => {
    console.error(`Official service sync failed: ${error.message}`)
    process.exitCode = 1
  })
}
