import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { connectDB } from './config/db.js'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errorMiddleware.js'
import applicationRoutes from './routes/applicationRoutes.js'
import authRoutes from './routes/authRoutes.js'
import contactRoutes from './routes/contactRoutes.js'
import jobRoutes from './routes/jobRoutes.js'
import projectRoutes from './routes/projectRoutes.js'
import serviceRoutes from './routes/serviceRoutes.js'
import userRoutes from './routes/userRoutes.js'
import { pathToFileURL } from 'node:url'

const app = express()

app.disable('x-powered-by')
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.clientUrls.includes(origin)) return callback(null, true)
    return callback(new Error('Origin is not allowed by CORS.'))
  },
}))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    data: {
      status: databaseConnected ? 'ok' : 'unavailable',
      database: databaseConnected ? 'connected' : 'disconnected',
    },
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/users', userRoutes)

app.use(notFound)
app.use(errorHandler)

export async function startServer() {
  await connectDB()
  return app.listen(env.port, () => {
    console.info(`ZAYER Digital API listening on port ${env.port}`)
  })
}

export default app

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectExecution) {
  startServer().catch((error) => {
    console.error('Server startup failed:', error.message)
    process.exitCode = 1
  })
}
