import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { serviceIcons } from '../common/serviceIcons.js'
import { getServiceDescription, getServiceTitle } from '../../data/officialServices.js'

export default function ServiceCard({ service, index, featured = false }) {
  const { language, t } = useLanguage()
  const Icon = serviceIcons[service.icon] || serviceIcons.Sparkles
  const title = getServiceTitle(service, language, t)
  const description = getServiceDescription(service, language, t, true)
  return <Link className={`service-card ${featured ? 'service-card-featured' : ''}`} to={`/services/${service.slug}`}>
    <div className="service-card-top"><span className="service-number">{String(index + 1).padStart(2, '0')}</span><Icon size={22} strokeWidth={1.55} /></div>
    <h3>{title}</h3>
    <p>{description}</p>
    <span className="card-arrow" aria-label={t.services.explore}><ArrowUpRight size={19} /></span>
  </Link>
}
