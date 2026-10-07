import { useCallback } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Hero from '../../components/sections/Hero.jsx'
import SectionTitle from '../../components/sections/SectionTitle.jsx'
import CTASection from '../../components/sections/CTASection.jsx'
import Reveal from '../../components/common/Reveal.jsx'
import PageMeta from '../../components/common/PageMeta.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { serviceIcons } from '../../components/common/serviceIcons.js'
import { serviceService } from '../../services/serviceService.js'
import { useApiResource } from '../../hooks/useApiResource.js'
import { ErrorState, LoadingState } from '../../components/common/ApiStates.jsx'
import { getServiceDescription, getServiceTitle } from '../../data/officialServices.js'

export default function ServiceDetails() {
  const { slug } = useParams()
  const { t, language } = useLanguage()
  const loadService = useCallback(() => serviceService.getServiceBySlug(slug), [slug])
  const { data: service, loading, error, reload } = useApiResource(loadService, [loadService])
  if (loading) return <section className="section"><div className="container"><LoadingState label={t.common.loading} /></div></section>
  if (error) return <section className="section"><div className="container"><ErrorState message={error} onRetry={reload} /></div></section>
  if (!service) return <section className="section"><div className="container"><ErrorState message="This service could not be found." /></div></section>
  const Icon = serviceIcons[service.icon] || serviceIcons.Sparkles
  const title = getServiceTitle(service, language, t)
  const description = getServiceDescription(service, language, t)
  const features = service.features || service.benefits?.[language] || []
  return <>
    <PageMeta title={`${title} Services`} description={description} />
    <Hero compact label={t.services.label} title={<>{title}</>} description={description} primary={{ to: '/contact', label: t.common.getInTouch }} />
    <section className="section detail-section"><div className="container detail-layout">
      <div className="detail-main"><Reveal><div className="detail-icon"><Icon size={27} /></div><SectionTitle eyebrow={t.services.benefits} title={title} description={description} /></Reveal>
        <div className="benefit-list">{features.map((benefit, i) => <Reveal key={benefit} delay={i * 55}><div className="benefit-row"><span><Check size={16} /></span><p>{benefit}</p></div></Reveal>)}</div>
      </div>
      <Reveal className="detail-aside"><h3>{t.services.category}</h3><p>{t.categories[service.category] || service.category}</p>
        {service.technologies && <><h3 className="tech-title">{t.services.technologies}</h3><div className="tag-list">{service.technologies.map((item) => <span key={item}>{item}</span>)}</div></>}
      </Reveal>
    </div></section>
    <section className="section section-soft"><div className="container detail-bottom"><div><span className="eyebrow">A CONNECTED APPROACH</span><h2>Built to work with the rest of your digital journey.</h2></div><Link className="button button-dark" to="/contact">{t.common.getInTouch}<ArrowUpRight size={17} /></Link></div></section>
    <CTASection title={t.services.ctaTitle} description={t.services.ctaCopy} />
  </>
}
