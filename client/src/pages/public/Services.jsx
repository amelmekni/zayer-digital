import { useCallback } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageMeta from '../../components/common/PageMeta.jsx'
import Reveal from '../../components/common/Reveal.jsx'
import { ErrorState, LoadingState } from '../../components/common/ApiStates.jsx'
import { serviceIcons } from '../../components/common/serviceIcons.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { getOfficialServices, getServiceDescription, getServiceTitle } from '../../data/officialServices.js'
import { useApiResource } from '../../hooks/useApiResource.js'
import { serviceService } from '../../services/serviceService.js'

const proofPoints = ['A', 'B', 'C', 'D']

export default function Services() {
  const { t, language } = useLanguage()
  const loadServices = useCallback(() => serviceService.getServices(), [])
  const { data, loading, error, reload } = useApiResource(loadServices, [loadServices])
  const services = getOfficialServices(data)
  const content = t.services

  return <>
    <PageMeta title={content.pageTitle} description={content.mission} />

    <section className="services-hero" aria-labelledby="services-hero-title">
      <video className="services-hero-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
        <source src="/videos/hero-2.mp4" type="video/mp4" />
      </video>
      <div className="services-hero-shade" aria-hidden="true" />
      <div className="container services-hero-inner">
        <Reveal className="services-hero-copy">
          <span className="services-kicker">{content.heroEyebrow}</span>
          <h1 id="services-hero-title">{content.heroTitle[0]}<br /><em>{content.heroTitle[1]}</em></h1>
          <p>{content.mission}</p>
          <div className="services-hero-actions">
            <Link className="services-button services-button-gold" to="/contact">{content.heroPrimary}<ArrowUpRight size={17} /></Link>
            <Link className="services-hero-secondary" to="/contact">{content.heroSecondary}<ArrowDownRight size={16} /></Link>
          </div>
        </Reveal>
        <span className="services-hero-index" aria-hidden="true">{content.heroSideNote}</span>
      </div>
      <a className="services-hero-scroll" href="#services-list"><span>{content.scrollLabel}</span><span aria-hidden="true">↓</span></a>
    </section>

    <section className="services-disciplines" id="services-list">
      <div className="container">
        <Reveal className="services-section-heading">
          <div>
            <span className="services-eyebrow">{content.allEyebrow}</span>
            <h2>{content.disciplinesTitle[0]}<br /><em>{content.disciplinesTitle[1]}</em></h2>
          </div>
          <p>{content.mission}</p>
        </Reveal>

        {loading && <LoadingState label={t.common.loading} />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && services.length === 0 && <p className="services-api-empty">{content.empty}</p>}
        {!loading && !error && services.length > 0 && <div className="services-editorial-grid">
          {services.map((service, index) => {
            const Icon = serviceIcons[service.icon] || serviceIcons.Sparkles
            return <Reveal key={service._id || service.slug} delay={index * 45}>
              <Link className="services-editorial-item" to={`/services/${service.slug}`}>
                <div className="services-editorial-top">
                  <span className="services-editorial-number">{String(index + 1).padStart(2, '0')}</span>
                  <Icon size={23} strokeWidth={1.45} aria-hidden="true" />
                </div>
                <div className="services-editorial-copy">
                  <h3>{getServiceTitle(service, language, t)}</h3>
                  <p>{getServiceDescription(service, language, t, true)}</p>
                </div>
                <span className="services-editorial-link" aria-label={`${content.discover}: ${getServiceTitle(service, language, t)}`}><ArrowUpRight size={18} /></span>
              </Link>
            </Reveal>
          })}
        </div>}
      </div>
    </section>

    <section className="services-performance" aria-label={content.performanceTitle}>
      <div className="container services-performance-inner">
        <Reveal className="services-performance-heading">
          <span className="services-eyebrow">{content.performanceEyebrow}</span>
          <h2>{content.performanceTitle}</h2>
        </Reveal>
        <div className="services-stat-grid">
          {content.stats.map(([value, label], index) => <Reveal key={value} delay={index * 65}>
            <div className="services-stat">
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </Reveal>)}
        </div>
      </div>
    </section>

    <section className="services-why">
      <div className="container services-why-layout">
        <Reveal className="services-why-intro">
          <span className="services-eyebrow">{content.whyEyebrow}</span>
          <h2>{content.whyTitle[0]}<br /><em>{content.whyTitle[1]}</em></h2>
          <span className="services-editorial-rule" aria-hidden="true" />
        </Reveal>
        <div className="services-proof-list">
          {content.why.map(([title, description], index) => <Reveal key={title} delay={index * 55}>
            <article className="services-proof-item">
              <span className="services-proof-letter">{proofPoints[index]}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          </Reveal>)}
        </div>
      </div>
    </section>

    <section className="services-sectors">
      <div className="container services-sectors-layout">
        <Reveal>
          <span className="services-eyebrow">{content.sectorsEyebrow}</span>
          <h2>{content.sectorsTitle}</h2>
        </Reveal>
        <div className="services-sector-list">
          {content.sectors.map((sector, index) => <Reveal key={sector} delay={index * 45}>
            <span className="services-sector">{sector}</span>
          </Reveal>)}
        </div>
      </div>
    </section>

    <section className="services-method">
      <div className="container">
        <Reveal className="services-method-heading">
          <span className="services-eyebrow">{content.methodologyEyebrow}</span>
          <h2>{content.methodologyTitle}</h2>
          <p>{content.methodologySubtitle}</p>
        </Reveal>
        <div className="services-method-list">
          {content.methodology.map(([title, description], index) => <Reveal key={title} delay={index * 60}>
            <article className="services-method-step">
              <span className="services-method-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="services-method-copy"><h3>{title}</h3><p>{description}</p></div>
              <span className="services-method-mark" aria-hidden="true">/ 0{index + 1}</span>
            </article>
          </Reveal>)}
        </div>
      </div>
    </section>

    <section className="services-final-cta">
      <div className="container services-final-cta-inner">
        <Reveal>
          <span className="services-eyebrow">{content.ctaEyebrow}</span>
          <h2>{content.ctaTitle}</h2>
          <p>{content.ctaCopy}</p>
        </Reveal>
        <Reveal><Link className="services-button services-button-navy" to="/contact">{content.ctaAction}<ArrowUpRight size={17} /></Link></Reveal>
      </div>
    </section>
  </>
}
