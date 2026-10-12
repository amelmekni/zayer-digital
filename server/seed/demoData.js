import { officialServices } from './officialServices.js'

export const DEMO_PASSWORD = 'ZayerDemo-Local-2026!'

export const DEMO_IDS = Object.freeze({
  users: {
    admin: '65a000000000000000000001',
    sales: '65a000000000000000000002',
    user: '65a000000000000000000003',
  },
  services: {
    seo: '65a000000000000000000101',
    'social-media': '65a000000000000000000102',
    'paid-ads': '65a000000000000000000103',
    branding: '65a000000000000000000104',
    'shopify-wordpress': '65a000000000000000000105',
    'digital-strategy': '65a000000000000000000106',
  },
  projects: {
    creative: '65a000000000000000000201',
    web: '65a000000000000000000202',
    impact: '65a000000000000000000203',
  },
  job: '65a000000000000000000301',
  application: '65a000000000000000000401',
  contact: '65a000000000000000000501',
  quotes: {
    approved: '65a000000000000000000601',
    draft: '65a000000000000000000602',
  },
  quoteLines: {
    project: '65a000000000000000000611',
    retainer: '65a000000000000000000612',
    draft: '65a000000000000000000621',
  },
  collections: [
    '65a000000000000000000701',
    '65a000000000000000000702',
    '65a000000000000000000703',
  ],
})

export const DEMO_EMAILS = Object.freeze({
  admin: 'demo.admin@zayer.local',
  sales: 'demo.sales@zayer.local',
  user: 'demo.user@zayer.local',
})

export function createDemoDocuments(passwordHash) {
  const services = officialServices.map((service) => ({
    _id: DEMO_IDS.services[service.slug],
    ...service,
    shortDescription: service.description,
    description: `${service.description} Fictional local demonstration catalogue entry.`,
    unit: 'project',
    price: {
      seo: 450,
      'social-media': 650,
      'paid-ads': 500,
      branding: 800,
      'shopify-wordpress': 1800,
      'digital-strategy': 350,
    }[service.slug],
    currency: 'TND',
    features: ['Fictional demo scope; not a real offer.'],
    isActive: true,
  }))

  const users = [
    {
      _id: DEMO_IDS.users.admin,
      name: 'Demo Administrator',
      email: DEMO_EMAILS.admin,
      password: passwordHash,
      role: 'admin',
      isActive: true,
      tokenVersion: 0,
    },
    {
      _id: DEMO_IDS.users.sales,
      name: 'Demo Sales Agent',
      email: DEMO_EMAILS.sales,
      password: passwordHash,
      role: 'sales_agent',
      isActive: true,
      tokenVersion: 0,
    },
    {
      _id: DEMO_IDS.users.user,
      name: 'Demo Standard User',
      email: DEMO_EMAILS.user,
      password: passwordHash,
      role: 'user',
      isActive: true,
      tokenVersion: 0,
    },
  ]

  const projects = [
    {
      _id: DEMO_IDS.projects.creative,
      title: 'Demo Identity System',
      slug: 'demo-identity-system',
      description: 'Fictional branding case study for local interface testing.',
      category: 'creative',
      portfolioSection: 'creative',
      sector: 'Fictional retail',
      image: 'https://example.invalid/demo-identity.jpg',
      client: 'Demo Client',
      year: 2026,
      featured: true,
      isPublished: true,
    },
    {
      _id: DEMO_IDS.projects.web,
      title: 'Demo Commerce Website',
      slug: 'demo-commerce-website',
      description: 'Fictional web project for local portfolio testing.',
      category: 'ecommerce',
      portfolioSection: 'web',
      sector: 'Fictional retail',
      image: 'https://example.invalid/demo-commerce.jpg',
      client: 'Demo Client',
      year: 2026,
      featured: false,
      isPublished: true,
    },
    {
      _id: DEMO_IDS.projects.impact,
      title: 'Demo Campaign',
      slug: 'demo-campaign',
      description: 'Fictional digital campaign without claimed business results.',
      category: 'marketing',
      portfolioSection: 'impact',
      sector: 'Fictional services',
      image: 'https://example.invalid/demo-campaign.jpg',
      client: 'Demo Client',
      year: 2026,
      featured: false,
      isPublished: true,
    },
  ]

  const jobs = [{
    _id: DEMO_IDS.job,
    title: 'Demo Marketing Specialist',
    slug: 'demo-marketing-specialist',
    department: 'Marketing',
    location: 'Remote',
    type: 'full-time',
    experience: 'Fictional demo role',
    description: 'A fictional opening used only to test the local careers workflow.',
    requirements: ['Demo requirement'],
    responsibilities: ['Demo responsibility'],
    isActive: true,
  }]

  const applications = [{
    _id: DEMO_IDS.application,
    job: DEMO_IDS.job,
    firstName: 'Demo',
    lastName: 'Applicant',
    email: 'demo.applicant@zayer.local',
    phone: '+21600000000',
    cv: 'https://example.invalid/demo-cv',
    message: 'Fictional application for local testing only.',
    status: 'reviewing',
  }]

  const contacts = [{
    _id: DEMO_IDS.contact,
    name: 'Demo Contact',
    email: 'demo.contact@zayer.local',
    company: 'Demo Company',
    subject: 'Local demonstration enquiry',
    message: 'Fictional contact message; no real customer data.',
    status: 'unread',
  }]

  const approvedAt = new Date('2026-09-15T12:00:00.000Z')
  const quoteLineItems = [
    {
      _id: DEMO_IDS.quoteLines.project,
      kind: 'service',
      service: DEMO_IDS.services['shopify-wordpress'],
      title: 'Shopify & WordPress Websites',
      description: 'Fictional demo project scope.',
      unit: 'project',
      quantity: 1,
      unitPrice: 1800,
      monthlyPrice: 0,
      includedMonths: 0,
      startDelayMonths: 0,
    },
    {
      _id: DEMO_IDS.quoteLines.retainer,
      kind: 'retainer',
      title: 'Demo monthly support',
      description: 'Fictional recurring line used to demonstrate installments.',
      unit: 'month',
      quantity: 1,
      unitPrice: 0,
      monthlyPrice: 250,
      includedMonths: 0,
      contractMonths: 3,
      startDelayMonths: 0,
    },
  ]

  const quotes = [
    {
      _id: DEMO_IDS.quotes.approved,
      quoteNumber: 'ZD-900001',
      createdBy: DEMO_IDS.users.admin,
      client: {
        name: 'Demo Client',
        company: 'Fictional Company',
        email: 'demo.client@zayer.local',
      },
      proposal: 'Fictional quote for local workflow testing only.',
      currency: 'TND',
      lineItems: quoteLineItems,
      subtotal: 1800,
      discountAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      total: 1800,
      depositRate: 25,
      depositAmount: 450,
      balanceAmount: 1350,
      monthlyRecurringTotal: 250,
      paymentTerms: 'Demo terms only; not a commercial offer.',
      status: 'approved',
      approvedAt,
      payments: [{
        _id: '65a000000000000000000631',
        amount: 450,
        paidAt: new Date('2026-09-20T12:00:00.000Z'),
        note: 'Fictional demo deposit',
      }],
      paidAmount: 450,
      paymentStatus: 'deposit_paid',
      createdAt: new Date('2026-09-10T12:00:00.000Z'),
    },
    {
      _id: DEMO_IDS.quotes.draft,
      quoteNumber: 'ZD-900002',
      createdBy: DEMO_IDS.users.sales,
      client: {
        name: 'Demo Prospect',
        company: 'Example Demo Studio',
        email: 'demo.prospect@zayer.local',
      },
      proposal: 'Fictional draft for the sales-agent workflow.',
      currency: 'TND',
      lineItems: [{
        _id: DEMO_IDS.quoteLines.draft,
        kind: 'service',
        service: DEMO_IDS.services.branding,
        title: 'Branding & Creative',
        description: 'Fictional draft service snapshot.',
        unit: 'project',
        quantity: 1,
        unitPrice: 800,
        monthlyPrice: 0,
        includedMonths: 0,
        startDelayMonths: 0,
      }],
      subtotal: 800,
      discountAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      total: 800,
      depositRate: 25,
      depositAmount: 200,
      balanceAmount: 600,
      monthlyRecurringTotal: 0,
      paymentTerms: 'Demo terms only.',
      status: 'draft',
      payments: [],
      paidAmount: 0,
      paymentStatus: 'unpaid',
      createdAt: new Date('2026-09-25T12:00:00.000Z'),
    },
  ]

  const collections = [0, 1, 2].map((index) => ({
    _id: DEMO_IDS.collections[index],
    quote: DEMO_IDS.quotes.approved,
    quoteLineItem: DEMO_IDS.quoteLines.retainer,
    installmentNumber: index + 1,
    dueAt: new Date(Date.UTC(2026, 9 + index, 15, 12)),
    amount: 250,
    paidAmount: index === 0 ? 100 : 0,
    status: index === 0 ? 'partial' : 'pending',
    payments: index === 0 ? [{
      _id: '65a000000000000000000711',
      amount: 100,
      paidAt: new Date('2026-10-01T12:00:00.000Z'),
      note: 'Fictional demo partial payment',
    }] : [],
  }))

  return { users, services, projects, jobs, applications, contacts, quotes, collections }
}

export function demoRecordIdentities(data) {
  return [
    ...data.users.map((record) => ({ collection: 'User', record, unique: { email: record.email }, identity: ['email', 'role'] })),
    ...data.services.map((record) => ({ collection: 'Service', record, unique: { slug: record.slug }, identity: ['slug', 'title'] })),
    ...data.projects.map((record) => ({ collection: 'Project', record, unique: { slug: record.slug }, identity: ['slug', 'title'] })),
    ...data.jobs.map((record) => ({ collection: 'Job', record, unique: { slug: record.slug }, identity: ['slug', 'title'] })),
    ...data.applications.map((record) => ({ collection: 'Application', record, identity: ['email', 'firstName', 'lastName'] })),
    ...data.contacts.map((record) => ({ collection: 'ContactMessage', record, identity: ['email', 'subject'] })),
    ...data.quotes.map((record) => ({ collection: 'Quote', record, unique: { quoteNumber: record.quoteNumber }, identity: ['quoteNumber', 'createdBy'] })),
    ...data.collections.map((record) => ({
      collection: 'RetainerCollection',
      record,
      unique: {
        quote: record.quote,
        quoteLineItem: record.quoteLineItem,
        installmentNumber: record.installmentNumber,
      },
      identity: ['quote', 'quoteLineItem', 'installmentNumber'],
    })),
  ]
}
