import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDB() {
  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error.message)
  })

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  })

  console.info(`MongoDB connected: ${mongoose.connection.host}`)
}
