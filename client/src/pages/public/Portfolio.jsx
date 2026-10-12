import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUpRight, Download, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import PortfolioMediaCard from '../../components/cards/PortfolioMediaCard.jsx'
import PortfolioLightbox from '../../components/common/PortfolioLightbox.jsx'
import PageMeta from '../../components/common/PageMeta.jsx'
import Reveal from '../../components/common/Reveal.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { projectService } from '../../services/projectService.js'
import { publicQuoteService } from '../../services/publicQuoteService.js'
import { serviceService } from '../../services/serviceService.js'
import { useApiResource } from '../../hooks/useApiResource.js'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/ApiStates.jsx'
import { getOfficialServices, getServiceTitle, officialServiceSlugs } from '../../data/officialServices.js'
import {
  calculateIndicativeTotal,
  publicQuotePayload,
  validatePublicQuoteForm,
} from '../../utils/publicQuote.js'

function projectSection(project) {
  if (project.portfolioSection) return project.portfolioSection
  if (project.category === 'web' || project.category === 'ecommerce') return 'web'
  if (project.category === 'marketing' || project.category === 'mobile' || project.category === 'ai') return 'impact'
  return 'creative'
}

function serviceText(service, language, translations) {
  const discipline = translations.services.disciplines?.[service.slug]
  return {
    title: discipline?.title || getServiceTitle(service, language, translations),
    description: discipline?.description || service.shortDescription || '',
  }
}

function formatPrice(value, currency, language = 'fr') {
  const locale = language === 'fr' ? 'fr-TN' : 'en-TN'
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(value) + ` ${currency}`
}

export default function Portfolio() {
  const { t, language } = useLanguage()
  const content = t.legacy.portfolio
  const [categoryFilters, setCategoryFilters] = useState({ creative: 'all', web: 'all', impact: 'all' })
  const [activeProject, setActiveProject] = useState(null)
  const [selectedServices, setSelectedServices] = useState({})
  const [quoteForm, setQuoteForm] = useState({
    name: '',
    email: '',
    company: '',
    description: '',
    timeline: '',
  })
  const [quoteError, setQuoteError] = useState('')
  const [quoteSuccess, setQuoteSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [quoteSubmitted, setQuoteSubmitted] = useState(false)
  const submitLock = useRef(false)
  const loadProjects = useCallback(() => projectService.getProjects(), [])
  const loadServices = useCallback(() => serviceService.getServices(), [])
  const projectsResource = useApiResource(loadProjects, [loadProjects])
  const servicesResource = useApiResource(loadServices, [loadServices])
  const projects = projectsResource.data || []
  const services = getOfficialServices(servicesResource.data || [])
  const servicesBySlug = new Map(services.map((service) => [service.slug, service]))
  const sections = useMemo(() => content.sections.map((section) => {
    const items = projects.filter((project) => projectSection(project) === section.id)
    const categories = [...new Set(items.map((project) => project.sector || t.categories[project.category] || project.category).filter(Boolean))]
    const filtered = categoryFilters[section.id] === 'all'
      ? items
      : items.filter((project) => (project.sector || t.categories[project.category] || project.category) === categoryFilters[section.id])
    return { ...section, items: filtered, categories }
  }), [categoryFilters, content.sections, projects, t.categories])
  const selectedLines = services
    .filter((service) => Object.hasOwn(selectedServices, service._id))
    .map((service) => ({ service, quantity: Number(selectedServices[service._id]) }))
  const indicativeTotal = calculateIndicativeTotal(selectedLines)

  const closeLightbox = useCallback(() => setActiveProject(null), [])
  const toggleService = (service, checked) => {
    setQuoteSubmitted(false)
    setSelectedServices((current) => {
      if (!checked) {
        const next = { ...current }
        delete next[service._id]
        return next
      }
      return { ...current, [service._id]: '1' }
    })
  }
  const updateQuoteForm = (event) => {
    const { name, value } = event.target
    setQuoteForm((current) => ({ ...current, [name]: value }))
    setQuoteError('')
    setQuoteSuccess('')
    setQuoteSubmitted(false)
  }
  const getPayload = () => {
    const lines = selectedLines.map(({ service, quantity }) => ({
      service,
      quantity: Number.isInteger(quantity) ? quantity : 0,
    }))
    const validationError = validatePublicQuoteForm(quoteForm, lines)
    if (validationError) {
      setQuoteError(content.validation[validationError])
      return null
    }
    return publicQuotePayload(quoteForm, lines, language)
  }
  const downloadQuote = async () => {
    if (downloading || submitting) return
    setQuoteError('')
    setQuoteSuccess('')
    const payload = getPayload()
    if (!payload) return
    setDownloading(true)
    try {
      const pdf = await publicQuoteService.downloadPdf(payload)
      const url = URL.createObjectURL(pdf)
      const link = document.createElement('a')
      link.href = url
      link.download = 'ZAYER-Digital-estimation.pdf'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setQuoteError(content.requestError)
    } finally {
      setDownloading(false)
    }
  }
  const submitQuote = async (event) => {
    event.preventDefault()
    if (submitLock.current || downloading || quoteSubmitted) return
    setQuoteError('')
    setQuoteSuccess('')
    const payload = getPayload()
    if (!payload) return
    submitLock.current = true
    setSubmitting(true)
    try {
      const response = await publicQuoteService.submit(payload)
      setQuoteSubmitted(true)
      setQuoteSuccess(response?.officialQuoteCreated === false
        ? response.total === null
          ? content.requestSuccessCustom
          : content.requestSuccessPriced.replace('{amount}', formatPrice(response.total, response.currency, language))
        : content.requestSuccess)
    } catch (error) {
      setQuoteError(error?.status === 429 ? content.rateLimited : content.requestError)
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }
  const quantityChange = (service, value) => {
    setSelectedServices((current) => ({ ...current, [service._id]: value }))
    setQuoteError('')
    setQuoteSuccess('')
    setQuoteSubmitted(false)
  }
  return <>
    <PageMeta title="ZAYER Digital Portfolio" description={content.intro} />
    <section className="legacy-page-hero portfolio-hero">
      <div className="container">
        <div className="legacy-breadcrumb">
          <Link to="/">{t.nav.home}</Link><span>/</span><span aria-current="page">{content.breadcrumb}</span>
        </div>
        <div className="portfolio-hero-copy">
          <span className="portfolio-kicker">{content.heroEyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.intro}</p>
          <div className="portfolio-hero-actions">
            <a className="legacy-button legacy-button-gold" href="#devis">{content.heroPrimary}<ArrowUpRight size={16} /></a>
            <a className="portfolio-hero-secondary" href="#creative">{content.heroSecondary}<ArrowDown size={16} /></a>
          </div>
        </div>
        <div className="portfolio-hero-stats" aria-label={content.statsLabel}>
          {t.legacy.home.stats.map(([value, label]) => <div className="portfolio-hero-stat" key={label}>
            <strong>{value}</strong><span>{label}</span>
          </div>)}
        </div>
      </div>
    </section>

    <section className="legacy-section legacy-portfolio-services" id="portfolio-services">
      <div className="container">
        <Reveal>
          <span className="legacy-eyebrow">{content.servicesEyebrow}</span>
          <h2 className="legacy-section-title">{content.servicesTitle}</h2>
          <p className="portfolio-section-intro">{content.servicesIntro}</p>
        </Reveal>
        {servicesResource.loading && <LoadingState label={t.common.loading} />}
        {servicesResource.error && <ErrorState message={servicesResource.error} onRetry={servicesResource.reload} />}
        <div className="portfolio-services-grid">
          {officialServiceSlugs.map((slug, index) => {
            const service = servicesBySlug.get(slug)
            const discipline = t.services.disciplines?.[slug]
            const title = discipline?.title || (service && serviceText(service, language, t).title) || slug
            const description = discipline?.description || service?.shortDescription || ''
            return <article className="portfolio-service-card" key={slug}>
              <span className="portfolio-card-index">{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{description}</p>
              <a href="#devis" aria-label={`${content.requestService}: ${title}`}>
                {content.requestService}<ArrowUpRight size={15} />
              </a>
            </article>
          })}
        </div>
        {!servicesResource.loading && !servicesResource.error && services.length === 0
          && <p className="portfolio-catalog-note" role="status">{content.noServices}</p>}
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

    <section className="legacy-section legacy-quote-section portfolio-quote-section" id="devis">
      <div className="container">
        <Reveal className="legacy-centered-title portfolio-centered-title">
          <span className="legacy-eyebrow">{content.quoteEyebrow}</span>
          <h2>{content.quoteTitle}</h2>
          <p>{content.quoteIntro}</p>
        </Reveal>
        <form className="portfolio-quote-form" onSubmit={submitQuote} noValidate>
          <div className="portfolio-quote-main">
            <section className="portfolio-quote-step" aria-labelledby="portfolio-select-services">
              <div className="portfolio-quote-step-heading">
                <span>01</span>
                <div><h3 id="portfolio-select-services">{content.selectServices}</h3><p>{content.selectServicesHint}</p></div>
              </div>
              {servicesResource.loading && <LoadingState label={t.common.loading} />}
              {servicesResource.error && <ErrorState message={servicesResource.error} onRetry={servicesResource.reload} />}
              {!servicesResource.loading && !servicesResource.error && services.length === 0
                && <EmptyState message={content.noServices} />}
              {!servicesResource.loading && !servicesResource.error && services.map((service) => {
                const serviceId = service._id
                const checked = Object.hasOwn(selectedServices, serviceId)
                const { title, description } = serviceText(service, language, t)
                const unitPrice = calculateIndicativeTotal([{ service, quantity: 1 }])
                return <div className={`portfolio-quote-service${checked ? ' is-selected' : ''}`} key={serviceId}>
                  <label className="portfolio-quote-service-choice">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleService(service, event.target.checked)}
                    />
                    <span className="portfolio-quote-service-copy">
                      <strong>{title}</strong>
                      <small>{description || service.unit || 'service'}</small>
                    </span>
                    <span className="portfolio-quote-service-price">
                      {unitPrice === null ? content.customPricing : formatPrice(unitPrice, 'TND', language)}
                    </span>
                  </label>
                  {checked && <label className="portfolio-quote-quantity">
                    <span>{content.quantity}</span>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      inputMode="numeric"
                      value={selectedServices[serviceId]}
                      aria-label={`${content.quantity}: ${title}`}
                      onChange={(event) => quantityChange(service, event.target.value)}
                    />
                  </label>}
                </div>
              })}
            </section>

            <section className="portfolio-quote-step" aria-labelledby="portfolio-your-details">
              <div className="portfolio-quote-step-heading">
                <span>02</span>
                <div><h3 id="portfolio-your-details">{content.yourDetails}</h3><p>{content.detailsHint}</p></div>
              </div>
              <div className="portfolio-quote-fields">
                <label className="portfolio-quote-field">
                  <span>{content.name} *</span>
                  <input name="name" autoComplete="name" required maxLength="160" value={quoteForm.name} onChange={updateQuoteForm} />
                </label>
                <label className="portfolio-quote-field">
                  <span>{content.email} *</span>
                  <input name="email" type="email" autoComplete="email" required maxLength="254" value={quoteForm.email} onChange={updateQuoteForm} />
                </label>
                <label className="portfolio-quote-field">
                  <span>{content.company}</span>
                  <input name="company" autoComplete="organization" maxLength="160" value={quoteForm.company} onChange={updateQuoteForm} />
                </label>
                <label className="portfolio-quote-field">
                  <span>{content.timeline}</span>
                  <select name="timeline" value={quoteForm.timeline} onChange={updateQuoteForm}>
                    <option value="">{content.timelineOptions.none}</option>
                    <option value="asap">{content.timelineOptions.asap}</option>
                    <option value="within-1-month">{content.timelineOptions.oneMonth}</option>
                    <option value="within-3-months">{content.timelineOptions.threeMonths}</option>
                    <option value="flexible">{content.timelineOptions.flexible}</option>
                  </select>
                </label>
                <label className="portfolio-quote-field portfolio-quote-field-wide">
                  <span>{content.description} *</span>
                  <textarea
                    name="description"
                    rows="5"
                    minLength="10"
                    maxLength="5000"
                    required
                    value={quoteForm.description}
                    onChange={updateQuoteForm}
                  />
                  <small>{content.descriptionHint}</small>
                </label>
              </div>
            </section>
          </div>

          <aside className="portfolio-quote-summary" aria-label={content.summaryTitle}>
            <span className="portfolio-quote-summary-label">{content.summaryLabel}</span>
            <h3>{content.summaryTitle}</h3>
            {selectedLines.length > 0
              ? <ul className="portfolio-quote-summary-lines">
                {selectedLines.map(({ service, quantity }) => {
                  const { title } = serviceText(service, language, t)
                  const unitPrice = calculateIndicativeTotal([{ service, quantity: 1 }])
                  return <li key={service._id}>
                    <span>{title} <small>× {quantity}</small></span>
                    <strong>{unitPrice === null
                      ? content.customPricing
                      : formatPrice(unitPrice * quantity, 'TND', language)}</strong>
                  </li>
                })}
              </ul>
              : <p className="portfolio-quote-summary-empty">{content.summaryEmpty}</p>}
            <div className="portfolio-quote-summary-total">
              <span>{indicativeTotal === null ? content.totalPending : content.total}</span>
              {indicativeTotal !== null && <strong>{formatPrice(indicativeTotal, 'TND', language)}</strong>}
            </div>
            <p className="portfolio-quote-disclaimer">{content.quoteDisclaimer}</p>
            {quoteError && <p className="legacy-form-error" role="alert">{quoteError}</p>}
            {quoteSuccess && <p className="portfolio-quote-success" role="status" aria-live="polite">{quoteSuccess}</p>}
            <div className="portfolio-quote-actions">
              <button
                className="legacy-button portfolio-quote-secondary"
                type="button"
                onClick={downloadQuote}
                disabled={submitting || downloading}
              >
                <Download size={16} />{downloading ? content.downloadingPdf : content.downloadQuote}
              </button>
              <button
                className="legacy-button legacy-button-gold"
                type="submit"
                disabled={submitting || downloading || quoteSubmitted}
              >
                <Send size={16} />{submitting ? content.submitting : quoteSubmitted ? content.requestSent : content.submitRequest}
              </button>
            </div>
          </aside>
        </form>
      </div>
    </section>

    <section className="legacy-section legacy-portfolio-contact">
      <div className="container">
        <Reveal className="legacy-centered-title">
          <span className="legacy-eyebrow">{content.nextSteps}</span>
          <h2>{content.contactTitle}</h2>
          <p>{content.contactCopy}</p>
          <Link className="legacy-button legacy-button-gold" to="/contact">{content.contactButton}<ArrowUpRight size={16} /></Link>
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
