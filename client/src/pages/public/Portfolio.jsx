import { useCallback, useMemo, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import LegacyPageHero from '../../components/sections/LegacyPageHero.jsx'
import PortfolioMediaCard from '../../components/cards/PortfolioMediaCard.jsx'
import PortfolioLightbox from '../../components/common/PortfolioLightbox.jsx'
import PageMeta from '../../components/common/PageMeta.jsx'
import Reveal from '../../components/common/Reveal.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { projectService } from '../../services/projectService.js'
import { serviceService } from '../../services/serviceService.js'
import { useApiResource } from '../../hooks/useApiResource.js'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/ApiStates.jsx'
import { getOfficialServices, getServiceDescription, getServiceTitle } from '../../data/officialServices.js'

function projectSection(project) {
  if (project.portfolioSection) return project.portfolioSection
  if (project.category === 'web' || project.category === 'ecommerce') return 'web'
  if (project.category === 'marketing' || project.category === 'mobile' || project.category === 'ai') return 'impact'
  return 'creative'
}

function serviceText(service, language, translations) {
  const title = getServiceTitle(service, language, translations)
  const description = getServiceDescription(service, language, translations)
  return { title, description }
}

function formatPrice(value, currency, language = 'fr') {
  const locale = language === 'fr' ? 'fr-TN' : 'en-TN'
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value) + ` ${currency}`
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function printQuote({ name, selectedServices, currencyTotals, content, contact, language }) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return false

  const rows = selectedServices.map(({ title, price, currency }) =>
    `<tr><td>${escapeHtml(title)}</td><td>${escapeHtml(formatPrice(price, currency || 'TND', language))}</td></tr>`,
  ).join('')
  const totals = currencyTotals.map(({ currency, total }) =>
    `<div class="total"><span>${escapeHtml(content.quoteTotal)} — ${escapeHtml(currency)}</span><span>${escapeHtml(formatPrice(total, currency, language))}</span></div>`,
  ).join('')
  const client = name || content.quoteClient
  const locale = language === 'fr' ? 'fr-TN' : 'en-TN'
  const date = new Intl.DateTimeFormat(locale).format(new Date())
  const phones = contact.phones.map(([label]) => escapeHtml(label)).join(' · ')
  const html = `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><title>${escapeHtml(content.quoteDocumentTitle)}</title>
    <style>
      :root{--navy:#0a1628;--navy-mid:#122040;--navy-light:#1e3a6e;--gold:#c8a96e;--gold-light:#e8d5a8;--white:#ffffff;--off-white:#f7f5f0;--grey:#8a96a8;--light-grey:#e8edf4}
      body{font-family:"DM Sans",Arial,sans-serif;padding:40px;color:var(--navy);max-width:700px;margin:0 auto}
      h1{font-family:"Playfair Display",Georgia,serif;color:var(--navy);font-size:28px;margin:0 0 4px}
      h1 span{color:var(--gold)}
      .meta{color:var(--grey);font-size:13px;margin-bottom:30px;line-height:1.8}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      td{padding:10px 0;border-bottom:1px solid var(--light-grey)}
      td:last-child{text-align:right}
      .total{font-weight:bold;font-size:18px;border-top:2px solid var(--navy);padding-top:14px;display:flex;justify-content:space-between}
      footer{margin-top:40px;font-size:12px;color:var(--grey);line-height:1.7}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>ZAYER<span>.</span>Digital — ${escapeHtml(content.quoteDocumentTitle.split('—').at(-1).trim())}</h1>
    <div class="meta">${escapeHtml(content.quotePreparedFor)} : ${escapeHtml(client)}<br>${escapeHtml(content.quoteDate)} : ${escapeHtml(date)}<br>${escapeHtml(content.quoteValidity)}</div>
    <table>${rows}</table>
    ${totals}
    <footer>ZAYER Digital — ${escapeHtml(contact.email)} — ${phones} — ${escapeHtml(contact.website)} — ${escapeHtml(contact.location)}<br>${escapeHtml(content.quoteDisclaimer)}</footer>
    <script>window.addEventListener('load',()=>window.print())</script></body></html>`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  return true
}

export default function Portfolio() {
  const { t, language } = useLanguage()
  const content = t.legacy.portfolio
  const [categoryFilters, setCategoryFilters] = useState({ creative: 'all', web: 'all', impact: 'all' })
  const [activeProject, setActiveProject] = useState(null)
  const [expandedService, setExpandedService] = useState('')
  const [selectedPrices, setSelectedPrices] = useState({})
  const [quoteName, setQuoteName] = useState('')
  const [quoteError, setQuoteError] = useState('')
  const loadProjects = useCallback(() => projectService.getProjects(), [])
  const loadServices = useCallback(() => serviceService.getServices(), [])
  const projectsResource = useApiResource(loadProjects, [loadProjects])
  const servicesResource = useApiResource(loadServices, [loadServices])
  const projects = projectsResource.data || []
  const services = getOfficialServices(servicesResource.data || [])
  const sections = useMemo(() => content.sections.map((section) => {
    const items = projects.filter((project) => projectSection(project) === section.id)
    const categories = [...new Set(items.map((project) => project.sector || t.categories[project.category] || project.category).filter(Boolean))]
    const filtered = categoryFilters[section.id] === 'all'
      ? items
      : items.filter((project) => (project.sector || t.categories[project.category] || project.category) === categoryFilters[section.id])
    return { ...section, items: filtered, categories }
  }), [categoryFilters, content.sections, projects, t.categories])
  const pricedServices = services.filter((service) => Number.isFinite(Number(service.price)) && service.price !== '' && service.price != null)
  const selectedServices = pricedServices.filter((service) => selectedPrices[service._id || service.slug])
    .map((service) => ({ ...service, ...serviceText(service, language, t), price: Number(service.price) }))
  const currencyTotals = [...selectedServices.reduce((totals, service) => {
    const serviceCurrency = service.currency || 'TND'
    totals.set(serviceCurrency, (totals.get(serviceCurrency) || 0) + service.price)
    return totals
  }, new Map())].map(([currency, total]) => ({ currency, total }))

  const closeLightbox = useCallback(() => setActiveProject(null), [])
  const selectPrice = (serviceId, checked) => {
    setSelectedPrices((current) => ({ ...current, [serviceId]: checked }))
  }
  const downloadQuote = () => {
    setQuoteError('')
    if (!selectedServices.length) {
      setQuoteError(content.chooseService)
      return
    }
    if (!printQuote({ name: quoteName.trim(), selectedServices, currencyTotals, content, contact: t.legacy.footer, language })) {
      setQuoteError(content.popupBlocked)
    }
  }

  return <>
    <PageMeta title="ZAYER Digital Portfolio" description={content.intro} />
    <LegacyPageHero pageLabel={content.breadcrumb} title={content.title} description={content.intro} />

    <section className="legacy-section legacy-portfolio-services" id="portfolio-services">
      <div className="container">
        <Reveal><span className="legacy-eyebrow">{content.servicesEyebrow}</span><h2 className="legacy-section-title">{content.servicesTitle}</h2></Reveal>
        {servicesResource.loading && <LoadingState label={t.common.loading} />}
        {servicesResource.error && <ErrorState message={servicesResource.error} onRetry={servicesResource.reload} />}
        {!servicesResource.loading && !servicesResource.error && services.length === 0 && <EmptyState message={t.services.empty} />}
        {!servicesResource.loading && !servicesResource.error && services.length > 0 && <div className="legacy-portfolio-services-list">
          {services.map((service) => {
            const { title, description } = serviceText(service, language, t)
            const serviceId = service._id || service.slug
            const isExpanded = expandedService === serviceId
            return <article className={`legacy-portfolio-service ${isExpanded ? 'is-open' : ''}`} key={serviceId}>
              <button type="button" aria-expanded={isExpanded} onClick={() => setExpandedService(isExpanded ? '' : serviceId)}>
                <span className="legacy-service-dot" /><strong>{title}</strong><span className="legacy-service-chevron">▶</span>
              </button>
              {isExpanded && <p>{description}</p>}
            </article>
          })}
        </div>}
      </div>
    </section>

    {projectsResource.loading && <section className="legacy-section"><div className="container"><LoadingState label={t.common.loading} /></div></section>}
    {projectsResource.error && <section className="legacy-section"><div className="container"><ErrorState message={projectsResource.error} onRetry={projectsResource.reload} /></div></section>}
    {!projectsResource.loading && !projectsResource.error && sections.map((section, sectionIndex) => <section
      className={`legacy-section legacy-portfolio-section ${sectionIndex % 2 ? 'legacy-section-alt' : ''}`}
      id={section.id}
      key={section.id}
    >
      <div className="container">
        <Reveal><span className="legacy-eyebrow">{section.eyebrow}</span><h2 className="legacy-section-title">{section.title}</h2></Reveal>
        {section.categories.length > 0 && <div className="legacy-filter-pills" role="group" aria-label={`Filter ${section.title}`}>
          <button type="button" className={categoryFilters[section.id] === 'all' ? 'active' : ''} aria-pressed={categoryFilters[section.id] === 'all'}
            onClick={() => setCategoryFilters((current) => ({ ...current, [section.id]: 'all' }))}>{content.all}</button>
          {section.categories.map((category) => <button
            type="button"
            key={category}
            className={categoryFilters[section.id] === category ? 'active' : ''}
            aria-pressed={categoryFilters[section.id] === category}
            onClick={() => setCategoryFilters((current) => ({ ...current, [section.id]: category }))}
          >{category}</button>)}
        </div>}
        {section.items.length === 0
          ? <div className="legacy-empty-state"><span aria-hidden="true">{section.id === 'creative' ? '🎬' : section.id === 'web' ? '💻' : '📈'}</span>{section.items.length === 0 && projects.some((project) => projectSection(project) === section.id) ? t.portfolio.emptyCategory : section.empty}</div>
          : <div className={section.id === 'web' ? 'legacy-web-grid' : 'legacy-media-grid'}>
            {section.items.map((project) => <Reveal key={project._id || project.slug}>
              <PortfolioMediaCard
                project={project}
                section={section.id}
                viewSite={content.viewSite}
                onPreview={setActiveProject}
              />
            </Reveal>)}
          </div>}
      </div>
    </section>)}

    <section className="legacy-section legacy-quote-section" id="devis">
      <div className="container">
        <Reveal className="legacy-centered-title">
          <span className="legacy-eyebrow">{content.quoteEyebrow}</span><h2>{content.quoteTitle}</h2>
        </Reveal>
        <div className="legacy-quote-wrap">
          <label className="legacy-quote-name">
            <span className="sr-only">{content.quoteName}</span>
            <input value={quoteName} onChange={(event) => setQuoteName(event.target.value)} placeholder={content.quoteName} />
          </label>
          {servicesResource.loading && <LoadingState label={t.common.loading} />}
          {servicesResource.error && <ErrorState message={servicesResource.error} onRetry={servicesResource.reload} />}
          {!servicesResource.loading && !servicesResource.error && pricedServices.map((service) => {
            const serviceId = service._id || service.slug
            const { title } = serviceText(service, language, t)
            return <label className="legacy-quote-item" key={serviceId}>
              <input type="checkbox" checked={Boolean(selectedPrices[serviceId])} onChange={(event) => selectPrice(serviceId, event.target.checked)} />
              <span>{title}</span>              <strong>{formatPrice(Number(service.price), service.currency || 'TND', language)}</strong>
            </label>
          })}
          {!servicesResource.loading && !servicesResource.error && pricedServices.length === 0 && <div className="legacy-empty-state"><span aria-hidden="true">💰</span>{content.noPrices}</div>}
          {currencyTotals.length > 0
            ? currencyTotals.map(({ currency: totalCurrency, total }) => <div className="legacy-quote-total" key={totalCurrency}>
              <span>{content.total} · {totalCurrency}</span><strong>{formatPrice(total, totalCurrency, language)}</strong>
            </div>)
            : <div className="legacy-quote-total"><span>{content.total}</span><strong>—</strong></div>}
          {quoteError && <p className="legacy-form-error" role="alert">{quoteError}</p>}
          <button className="legacy-button legacy-button-gold legacy-quote-download" type="button" onClick={downloadQuote}>
            {content.downloadQuote}
          </button>
        </div>
      </div>
    </section>

    <section className="legacy-section legacy-portfolio-contact">
      <div className="container">
        <Reveal className="legacy-centered-title">
          <span className="legacy-eyebrow">{content.nextSteps}</span>
          <h2>{content.contactTitle}</h2>
          <p>{content.contactCopy}</p>
          <Link className="legacy-button legacy-button-gold" to="/contact">{t.nav.contact}<ArrowUpRight size={16} /></Link>
        </Reveal>
        <div className="legacy-portfolio-contact-links">
          <a href={`mailto:${t.legacy.footer.email}`}>{t.legacy.footer.email}</a>
          {t.legacy.footer.phones.map(([label, href]) => <a key={href} href={`tel:${href}`}>{label}</a>)}
          <a href={t.legacy.footer.websiteHref} target="_blank" rel="noopener noreferrer">{t.legacy.footer.website}</a>
          <span>{t.legacy.footer.location}</span>
        </div>
      </div>
    </section>
    <PortfolioLightbox project={activeProject} onClose={closeLightbox} />
  </>
}
