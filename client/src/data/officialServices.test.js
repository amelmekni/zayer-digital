import assert from 'node:assert/strict'
import test from 'node:test'
import en from '../translations/en.js'
import fr from '../translations/fr.js'
import {
  getOfficialServices,
  getServiceDescription,
  getServiceTitle,
  officialServiceSlugs,
} from './officialServices.js'

test('selects and orders the six official services returned by the API', () => {
  const services = [
    { slug: 'unrelated-service' },
    ...officialServiceSlugs.map((slug) => ({ slug })),
  ]

  assert.deepEqual(
    getOfficialServices(services).map((service) => service.slug),
    officialServiceSlugs,
  )
  assert.deepEqual(getOfficialServices([]), [])
})

test('renders official service names and descriptions using the active language', () => {
  const services = getOfficialServices(officialServiceSlugs.map((slug) => ({
    slug,
    title: 'API title',
    shortDescription: 'API summary',
  })))

  for (const service of services) {
    assert.equal(
      getServiceTitle(service, 'fr', fr),
      fr.services.disciplines[service.slug].title,
    )
    assert.equal(
      getServiceDescription(service, 'fr', fr, true),
      fr.services.disciplines[service.slug].description,
    )
    assert.equal(
      getServiceTitle(service, 'en', en),
      service.title,
    )
    assert.equal(
      getServiceDescription(service, 'en', en, true),
      service.shortDescription,
    )
  }
})
