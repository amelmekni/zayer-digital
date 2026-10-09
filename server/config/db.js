import mongoose from 'mongoose'
import { env } from './env.js'
import { initializeAdminAccountGuard } from '../utils/adminAccountGuard.js'

export async function connectDB() {
  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error.message)
  })

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  })

  await initializeAdminAccountGuard()
  console.info(`MongoDB connected: ${mongoose.connection.host}`)
}
