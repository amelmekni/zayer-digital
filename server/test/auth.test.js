import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { after, before, test } from 'node:test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const testAdminPassword = randomBytes(24).toString('base64url')
process.env.NODE_ENV = 'test'
const testMongoUri = new URL(process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017')
testMongoUri.pathname = `/zayer-digital-auth-test-${process.pid}`
process.env.MONGO_URI = testMongoUri.href
process.env.JWT_SECRET = randomBytes(48).toString('hex')
process.env.JWT_EXPIRES_IN = '15m'
process.env.ADMIN_NAME = 'Seed Test Admin'
process.env.ADMIN_EMAIL = `seed-admin-${process.pid}@example.test`
process.env.ADMIN_PASSWORD = testAdminPassword

const [{ default: mongoose }, { default: bcrypt }, { default: jwt }, { default: app }, { default: User }, { default: Service }, { default: Project }, { default: Job }, { default: Application }, { default: ContactMessage }] = await Promise.all([
  import('mongoose'),
  import('bcryptjs'),
  import('jsonwebtoken'),
  import('../server.js'),
  import('../models/User.js'),
  import('../models/Service.js'),
  import('../models/Project.js'),
  import('../models/Job.js'),
  import('../models/Application.js'),
  import('../models/ContactMessage.js'),
])

let server
let baseUrl

before(async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  await mongoose.connection.dropDatabase()
  await Promise.all([
    User.syncIndexes(),
    Service.syncIndexes(),
    Project.syncIndexes(),
    Job.syncIndexes(),
    Application.syncIndexes(),
    ContactMessage.syncIndexes(),
  ])
  server = app.listen(0)
  await new Promise((resolveListening, reject) => {
    server.once('listening', resolveListening)
    server.once('error', reject)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolveClose, reject) => {
    server.close((error) => error ? reject(error) : resolveClose())
  })
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = await response.json()
  return { response, data }
}

test('Phase 5 authentication, authorization, seed and public route controls', async () => {
  const registerBody = {
    name: 'Test User',
    email: '  TEST.USER@example.test ',
    password: 'user-test-password-12',
    role: 'admin',
  }
  const escalatedRegistration = await request('/api/auth/register', { method: 'POST', body: registerBody })
  assert.equal(escalatedRegistration.response.status, 400)
  assert.match(escalatedRegistration.data.error.message, /Unsupported field/)
  assert.equal(await User.exists({ email: 'test.user@example.test' }), null)

  delete registerBody.role
  const registered = await request('/api/auth/register', { method: 'POST', body: registerBody })
  assert.equal(registered.response.status, 201)
  assert.equal(registered.data.data.user.role, 'user')
  assert.equal(registered.data.data.user.email, 'test.user@example.test')
  assert.equal('password' in registered.data.data.user, false)
  assert.equal('token' in registered.data.data, false)

  const storedUser = await User.findOne({ email: 'test.user@example.test' }).select('+password')
  assert.ok(storedUser.password.startsWith('$2'))
  assert.notEqual(storedUser.password, registerBody.password)
  assert.equal(await bcrypt.compare(registerBody.password, storedUser.password), true)
  assert.equal(await User.findById(storedUser.id).then((user) => user.password), undefined)

  const duplicate = await request('/api/auth/register', { method: 'POST', body: registerBody })
  assert.equal(duplicate.response.status, 409)
  assert.equal(JSON.stringify(duplicate.data).includes(registerBody.password), false)

  const badPassword = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'test.user@example.test', password: 'incorrect-password' },
  })
  const unknownEmail = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'missing@example.test', password: 'incorrect-password' },
  })
  assert.equal(badPassword.response.status, 401)
  assert.equal(badPassword.data.error.message, unknownEmail.data.error.message)

  const userLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: ' TEST.USER@example.test ', password: registerBody.password },
  })
  assert.equal(userLogin.response.status, 200)
  assert.equal(userLogin.data.data.user.role, 'user')
  assert.equal('password' in userLogin.data.data.user, false)
  const userToken = userLogin.data.data.token
  const userPayload = jwt.decode(userToken)
  assert.deepEqual(Object.keys(userPayload).sort(), ['exp', 'iat', 'role', 'userId'])
  assert.equal(userPayload.role, 'user')
  assert.equal((await request('/api/auth/me', { token: userToken })).response.status, 200)
  assert.equal((await request('/api/auth/me')).response.status, 401)
  assert.equal((await request('/api/auth/me', { token: 'invalid.token.value' })).response.status, 401)
  const expiredToken = jwt.sign({ userId: storedUser.id, role: 'user' }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: -1,
  })
  assert.equal((await request('/api/auth/me', { token: expiredToken })).response.status, 401)

  const seedEnvironment = {
    ...process.env,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    ADMIN_NAME: process.env.ADMIN_NAME,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: testAdminPassword,
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const seeded = spawnSync(process.execPath, ['seed/seedAdmin.js'], {
      cwd: resolve(testDirectory, '..'),
      env: seedEnvironment,
      encoding: 'utf8',
      timeout: 15000,
    })
    assert.equal(seeded.status, 0, `Admin seed should succeed: ${seeded.stderr}`)
  }
  const seededAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL }).select('+password')
  assert.equal(seededAdmin.role, 'admin')
  assert.notEqual(seededAdmin.password, testAdminPassword)
  assert.equal(await bcrypt.compare(testAdminPassword, seededAdmin.password), true)

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: process.env.ADMIN_EMAIL, password: testAdminPassword },
  })
  assert.equal(adminLogin.response.status, 200)
  const adminToken = adminLogin.data.data.token

  assert.equal((await request('/api/users')).response.status, 401)
  assert.equal((await request('/api/users', { token: userToken })).response.status, 403)
  assert.equal((await request('/api/users', { token: adminToken })).response.status, 200)
  assert.equal((await request(`/api/users/${storedUser.id}`, { token: userToken })).response.status, 403)
  assert.equal((await request(`/api/users/${storedUser.id}`, {
    method: 'DELETE',
    token: userToken,
  })).response.status, 403)
  const passwordUpdate = await request(`/api/users/${storedUser.id}`, {
    method: 'PUT',
    token: adminToken,
    body: { password: 'replacement-password' },
  })
  assert.equal(passwordUpdate.response.status, 400)

  assert.equal((await request('/api/services')).response.status, 200)
  assert.equal((await request('/api/projects')).response.status, 200)
  assert.equal((await request('/api/jobs')).response.status, 200)
  assert.equal((await request('/api/services', {
    method: 'POST',
    body: { title: 'Protected service' },
  })).response.status, 401)
  assert.equal((await request('/api/services', {
    method: 'POST',
    token: userToken,
    body: { title: 'Protected service' },
  })).response.status, 403)

  const serviceBody = {
    title: 'Test Development',
    slug: 'test-development',
    shortDescription: 'Test service description.',
    description: 'A test-only service for API authorization checks.',
    category: 'development',
  }
  const createdService = await request('/api/services', {
    method: 'POST',
    token: adminToken,
    body: serviceBody,
  })
  assert.equal(createdService.response.status, 201)
  const serviceId = createdService.data.data._id
  assert.equal((await request('/api/services/test-development')).response.status, 200)
  assert.equal((await request(`/api/services/${serviceId}`, {
    method: 'PUT',
    token: userToken,
    body: { title: 'Denied update' },
  })).response.status, 403)
  assert.equal((await request(`/api/services/${serviceId}`, {
    method: 'PUT',
    token: adminToken,
    body: { title: 'Updated test service' },
  })).response.status, 200)
  assert.equal((await request(`/api/services/${serviceId}`, {
    method: 'DELETE',
    token: adminToken,
  })).response.status, 200)

  const project = await request('/api/projects', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Test Project',
      slug: 'test-project',
      description: 'Test-only published project.',
      category: 'web',
      image: 'https://example.test/project.jpg',
      isPublished: true,
    },
  })
  assert.equal(project.response.status, 201)
  assert.equal((await request('/api/projects/test-project')).response.status, 200)
  assert.equal((await request(`/api/projects/${project.data.data._id}`, {
    method: 'PUT',
    token: userToken,
    body: { title: 'Denied update' },
  })).response.status, 403)
  assert.equal((await request(`/api/projects/${project.data.data._id}`, {
    method: 'DELETE',
    token: userToken,
  })).response.status, 403)
  assert.equal((await request(`/api/projects/${project.data.data._id}`, {
    method: 'PUT',
    token: adminToken,
    body: { title: 'Updated test project' },
  })).response.status, 200)

  const job = await request('/api/jobs', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Test Developer',
      slug: 'test-developer',
      department: 'Engineering',
      location: 'Remote',
      type: 'full-time',
      description: 'Test-only role.',
      isActive: true,
    },
  })
  assert.equal(job.response.status, 201)
  assert.equal((await request('/api/jobs/test-developer')).response.status, 200)
  assert.equal((await request(`/api/jobs/${job.data.data._id}`, {
    method: 'PUT',
    token: userToken,
    body: { title: 'Denied update' },
  })).response.status, 403)
  assert.equal((await request(`/api/jobs/${job.data.data._id}`, {
    method: 'DELETE',
    token: userToken,
  })).response.status, 403)
  assert.equal((await request(`/api/jobs/${job.data.data._id}`, {
    method: 'PUT',
    token: adminToken,
    body: { title: 'Updated test role' },
  })).response.status, 200)

  const application = await request('/api/applications', {
    method: 'POST',
    body: {
      job: job.data.data._id,
      firstName: 'Applicant',
      lastName: 'Example',
      email: 'applicant@example.test',
      cv: 'https://example.test/private-cv.pdf',
    },
  })
  assert.equal(application.response.status, 201)
  assert.equal('cv' in application.data.data, false)
  assert.equal((await request('/api/applications')).response.status, 401)
  assert.equal((await request('/api/applications', { token: userToken })).response.status, 403)
  assert.equal((await request('/api/applications', { token: adminToken })).response.status, 200)
  assert.equal((await request(`/api/applications/${application.data.data._id}`, { token: adminToken })).response.status, 200)
  assert.equal((await request(`/api/applications/${application.data.data._id}`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'reviewing' },
  })).response.status, 200)

  const contact = await request('/api/contact', {
    method: 'POST',
    body: {
      name: 'Contact Example',
      email: 'contact@example.test',
      subject: 'Test inquiry',
      message: 'This is a test-only contact message.',
    },
  })
  assert.equal(contact.response.status, 201)
  assert.equal((await request('/api/contact')).response.status, 401)
  assert.equal((await request('/api/contact', { token: userToken })).response.status, 403)
  assert.equal((await request('/api/contact', { token: adminToken })).response.status, 200)
  assert.equal((await request(`/api/contact/${contact.data.data._id}`, { token: adminToken })).response.status, 200)
  assert.equal((await request(`/api/contact/${contact.data.data._id}`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'read' },
  })).response.status, 200)

  assert.equal((await request('/api/jobs', {
    method: 'POST',
    token: adminToken,
    body: { ...serviceBody, slug: 'not-a-job' },
  })).response.status, 400)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const limitedLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'rate-limit@example.test', password: 'incorrect-password' },
    })
    assert.equal(limitedLogin.response.status, 401)
  }
  const rateLimitedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'rate-limit@example.test', password: 'incorrect-password' },
  })
  assert.equal(rateLimitedLogin.response.status, 429)
})
