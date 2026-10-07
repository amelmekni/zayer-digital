import assert from 'node:assert/strict'
import test from 'node:test'
import { officialServices } from '../seed/officialServices.js'

test('official service catalog contains exactly the six disciplines from the business profile', () => {
  assert.deepEqual(officialServices.map(({ slug, title, description }) => [slug, title, description]), [
    ['seo', 'SEO & Content Marketing', 'Rank higher, attract the right audience and build authority that strengthens over time.'],
    ['social-media', 'Social Media Management', 'Captivating content across all major platforms to build community, trust and loyalty.'],
    ['paid-ads', 'Paid Advertising (Google & Meta)', 'High-converting campaigns designed for maximum ROI, from creation to bidding and optimization.'],
    ['branding', 'Branding & Creative', 'Consistent visual identities, logos and brand guidelines that set you apart from day one.'],
    ['shopify-wordpress', 'Shopify & WordPress Websites', 'Fast, attractive websites optimized for conversion on the platforms that power millions of businesses.'],
    ['digital-strategy', 'Digital Strategy', 'We audit your digital footprint, analyze your competitors and build a roadmap aligned with your goals.'],
  ])
  assert.equal(officialServices.some((service) => 'price' in service || 'currency' in service), false)
})
