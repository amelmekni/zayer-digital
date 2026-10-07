import { useCallback } from 'react'
import { ArrowUpRight, BarChart3, Handshake, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import Hero from '../../components/sections/Hero.jsx'
import Reveal from '../../components/common/Reveal.jsx'
import PageMeta from '../../components/common/PageMeta.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { serviceService } from '../../services/serviceService.js'
import { useApiResource } from '../../hooks/useApiResource.js'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/ApiStates.jsx'
import { getOfficialServices, getServiceDescription, getServiceTitle } from '../../data/officialServices.js'

const featureIcons = [BarChart3, Users, ShieldCheck, Handshake]

export default function Home() {
  const { t, language } = useLanguage()
  const content = t.legacy.home
  const loadServices = useCallback(() => serviceService.getServices(), [])
  const { data: services, loading, error, reload } = useApiResource(loadServices, [loadServices])
  const stats = content.stats.map(([value, label]) => ({ value, label }))
  const officialServices = getOfficialServices(services)

  return <>
    <PageMeta title="ZAYER Digital — Digital Marketing Agency" description={content.intro} />
    <Hero
      video="hero-1.mp4"
      revealOnScroll
      label={content.eyebrow}
      title={<>{content.title[0]}<br />{content.title[1]} <em>{content.title[2]}</em><br />{content.title[3]}</>}
      description={content.intro}
      primary={{ to: '/contact', label: content.primary }}
      secondary={{ to: '/about', label: content.secondary }}
      stats={stats}
    />

    <div className="legacy-marquee" aria-label={content.marquee.join(', ')}>
      <div className="legacy-marquee-track">
        {[...content.marquee, ...content.marquee].map((item, index) =>
          <span className="legacy-marquee-item" key={`${item}-${index}`} aria-hidden={index >= content.marquee.length}>
            {item}<i aria-hidden="true" />
          </span>,
        )}
      </div>
    </div>

    <section className="legacy-section legacy-services" id="services">
      <div className="container">
        <Reveal className="legacy-section-header">
          <div>
            <span className="legacy-eyebrow">{content.servicesEyebrow}</span>
            <h2>{content.servicesTitle[0]}<br />{content.servicesTitle[1]}</h2>
          </div>
          <Link className="legacy-inline-link" to="/contact">{content.servicesCta}<ArrowUpRight size={16} /></Link>
        </Reveal>
        {loading && <LoadingState label={t.common.loading} />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && officialServices.length === 0 && <EmptyState message={t.services.empty} />}
        {!loading && !error && officialServices.length > 0 && <div className="legacy-service-grid">
          {officialServices.map((service, index) => {
            const title = getServiceTitle(service, language, t)
            const description = getServiceDescription(service, language, t, true)
            return <Reveal key={service._id || service.slug} delay={index * 70}>
              <article className="legacy-service-card">
                <span className="legacy-card-number">{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            </Reveal>
          })}
        </div>}
      </div>
    </section>

    <section className="legacy-why">
      <div className="container legacy-why-layout">
        <Reveal className="legacy-why-copy">
          <span className="legacy-eyebrow">{content.whyEyebrow}</span>
          <h2>{content.whyTitle[0]}<br />{content.whyTitle[1]}</h2>
          <p>{content.whyIntro}</p>
          <Link className="legacy-button legacy-button-gold" to="/about">{content.whyCta}<ArrowUpRight size={16} /></Link>
        </Reveal>
        <div className="legacy-features">
          {content.features.map(([title, description], index) => {
            const Icon = featureIcons[index]
            return <Reveal key={title} delay={index * 60}>
              <article className="legacy-feature">
                <span className="legacy-feature-icon"><Icon size={20} strokeWidth={1.6} /></span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </article>
            </Reveal>
          })}
        </div>
      </div>
    </section>

    <section className="legacy-section legacy-process">
      <div className="container">
        <Reveal>
          <span className="legacy-eyebrow">{content.processEyebrow}</span>
          <h2 className="legacy-section-title">{content.processTitle}</h2>
        </Reveal>
        <div className="legacy-process-grid">
          {content.steps.map(([title, description], index) => <Reveal key={title} delay={index * 70}>
            <article className="legacy-process-step">
              <span className="legacy-step-number">{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          </Reveal>)}
        </div>
      </div>
    </section>

    <section className="legacy-home-cta">
      <div className="container">
        <div className="legacy-home-cta-copy"><h2>{content.ctaTitle}</h2><p>{content.ctaCopy}</p></div>
        <Link className="legacy-button legacy-button-navy" to="/contact">{content.ctaButton}<ArrowUpRight size={16} /></Link>
      </div>
    </section>
  </>
}
