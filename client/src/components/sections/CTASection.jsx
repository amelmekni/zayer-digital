import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function CTASection({ title, description, light = false }) {
  const { t } = useLanguage()
  return <section className={`cta-section ${light ? 'cta-light' : ''}`}><div className="container cta-inner"><div><span className="eyebrow">{t.common.ctaEyebrow}</span><h2>{title}</h2><p>{description}</p></div><Link className="button button-gold" to="/contact">{t.common.ctaAction}<ArrowUpRight size={17} /></Link></div></section>
}
