const DEMO_DATABASE_NAME = 'zayer_digital_test'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function validateDemoSeedTarget({ nodeEnv, mongoUri, seedEnabled }) {
  if (!['development', 'test'].includes(String(nodeEnv || '').trim().toLowerCase())) {
    throw new Error('Demo seeding is allowed only when NODE_ENV is development or test.')
  }
  if (seedEnabled !== '1') {
    throw new Error('Set ZAYER_DEMO_SEED=1 to explicitly enable demo seeding.')
  }
  if (typeof mongoUri !== 'string' || !mongoUri.trim()) {
    throw new Error('A local MONGO_URI is required for demo seeding.')
  }

  let parsed
  try {
    parsed = new URL(mongoUri)
  } catch {
    throw new Error('MONGO_URI must be a valid local MongoDB URI.')
  }

  if (parsed.protocol !== 'mongodb:' || !LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('Demo seeding is restricted to a loopback mongodb:// host.')
  }
  let databaseName
  try {
    databaseName = decodeURIComponent(parsed.pathname.slice(1))
  } catch {
    throw new Error(`MONGO_URI must name the dedicated ${DEMO_DATABASE_NAME} database.`)
  }
  if (databaseName !== DEMO_DATABASE_NAME) {
    throw new Error(`MONGO_URI must name the dedicated ${DEMO_DATABASE_NAME} database.`)
  }

  return Object.freeze({ mongoUri: parsed.href, databaseName })
}

export function assertLocalReplicaSet(hello, { host, port }) {
  if (!hello?.setName || !(hello.isWritablePrimary || hello.ismaster)) {
    throw new Error('The dedicated local demo database must be a writable MongoDB replica set.')
  }
  if (!Array.isArray(hello.hosts) || hello.hosts.length !== 1) {
    throw new Error('The demo database must use a single-member local replica set.')
  }

  const [member] = hello.hosts
  const match = member.match(/^\[([^\]]+)\]:(\d+)$/) || member.match(/^(.+):(\d+)$/)
  if (!match) throw new Error('Could not verify the local replica-set member address.')
  const memberHost = match[1].toLowerCase()
  const memberPort = Number(match[2])
  const normalizedHost = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    !LOCAL_HOSTS.has(memberHost.replace(/^\[|\]$/g, ''))
    || !LOCAL_HOSTS.has(normalizedHost)
    || !Number.isInteger(port)
    || memberPort !== port
  ) {
    throw new Error('The replica-set member must match the configured loopback MongoDB host and port.')
  }
}

export const demoDatabaseName = DEMO_DATABASE_NAME
