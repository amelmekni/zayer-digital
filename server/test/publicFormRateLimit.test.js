import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, test } from 'node:test'

process.env.NODE_ENV = 'test'
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/zayer-digital-rate-limit-test'
process.env.JWT_SECRET = randomBytes(48).toString('hex')

const [{ default: express }, { default: applicationRoutes }, { default: contactRoutes }, { errorHandler }] = await Promise.all([
  import('express'),
  import('../routes/applicationRoutes.js'),
  import('../routes/contactRoutes.js'),
  import('../middleware/errorMiddleware.js'),
])

const app = express()
app.use(express.json())
app.use('/api/applications', applicationRoutes)
app.use('/api/contact', contactRoutes)
app.use(errorHandler)

let server
let baseUrl

before(async () => {
  server = app.listen(0)
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
})

test('public form POSTs are independently limited without limiting GET routes', async () => {
  for (const path of ['/api/contact', '/api/applications']) {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      assert.equal(response.status, 400)
    }

    const limitedResponse = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    assert.equal(limitedResponse.status, 429)
    assert.deepEqual(await limitedResponse.json(), {
      success: false,
      error: { message: 'Too many form submissions. Try again later.' },
    })
  }

  for (const path of ['/api/contact', '/api/applications']) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await fetch(`${baseUrl}${path}`)
      assert.equal(response.status, 401)
    }
  }
})
