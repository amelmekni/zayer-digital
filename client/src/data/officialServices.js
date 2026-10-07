export const officialServiceSlugs = [
  'seo',
  'social-media',
  'paid-ads',
  'branding',
  'shopify-wordpress',
  'digital-strategy',
]

export function getOfficialServices(services = []) {
  const servicesBySlug = new Map((services || []).map((service) => [service.slug, service]))
  return officialServiceSlugs.map((slug) => servicesBySlug.get(slug)).filter(Boolean)
}

export function getServiceTitle(service, language, translations) {
  const localizedTitle = translations.services.disciplines?.[service.slug]?.title
  if (language === 'fr' && localizedTitle) return localizedTitle
  return typeof service.title === 'string'
    ? service.title
    : service.title?.[language] || translations.serviceNames[service.key] || service.slug
}

export function getServiceDescription(service, language, translations, summary = false) {
  const localizedDescription = translations.services.disciplines?.[service.slug]?.description
  if (language === 'fr' && localizedDescription) return localizedDescription

  const description = summary ? service.shortDescription : service.description
  if (typeof description === 'string') return description
  if (description?.[language]) return description[language]
  return typeof service.description === 'string' ? service.description : ''
}
