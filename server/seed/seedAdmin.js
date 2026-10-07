import bcrypt from 'bcryptjs'
import { pathToFileURL } from 'node:url'
import { connectDB } from '../config/db.js'
import { env } from '../config/env.js'
import User from '../models/User.js'
import { validatePassword } from '../utils/passwordPolicy.js'

export async function seedAdmin() {
  const name = process.env.ADMIN_NAME?.trim()
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD

  if (!name || name.length < 2 || name.length > 100) {
    throw new Error('ADMIN_NAME must be between 2 and 100 characters.')
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.')
  }
  const passwordError = validatePassword(password)
  if (passwordError) {
    throw new Error(`ADMIN_PASSWORD is invalid: ${passwordError}`)
  }

  await connectDB()
  try {
    const existingUser = await User.findOne({ email }).select('_id role')
    if (existingUser) {
      if (existingUser.role !== 'admin') {
        throw new Error('ADMIN_EMAIL belongs to a non-admin account; choose a different email.')
      }
      console.info(`Administrator account already exists for ${email}.`)
      return { created: false }
    }

    const passwordHash = await bcrypt.hash(password, env.bcryptRounds)
    await User.create({
      name,
      email,
      password: passwordHash,
      role: 'admin',
    })

    console.info(`Administrator account created for ${email}.`)
    return { created: true }
  } finally {
    await User.db.close()
  }
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectExecution) {
  seedAdmin().catch((error) => {
    console.error(`Admin seed failed: ${error.message}`)
    process.exitCode = 1
  })
}
