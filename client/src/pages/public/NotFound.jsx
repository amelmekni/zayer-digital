import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext.jsx'
import PageMeta from '../../components/common/PageMeta.jsx'

export default function NotFound() {
  const { t } = useLanguage()
  return <section className="not-found"><PageMeta title={t.common.notFound} description={t.common.notFoundText} /><span className="eyebrow">404 / ZAYER DIGITAL</span><h1>{t.common.notFound}</h1><p>{t.common.notFoundText}</p><Link className="button button-dark" to="/"><ArrowLeft size={17} />{t.common.backHome}</Link></section>
}
