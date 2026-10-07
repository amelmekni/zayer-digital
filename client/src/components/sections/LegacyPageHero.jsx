import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function LegacyPageHero({ pageLabel, title, description }) {
  const { t } = useLanguage()

  return <section className="legacy-page-hero">
    <div className="container">
      <div className="legacy-breadcrumb">
        <Link to="/">{t.nav.home}</Link><span>/</span><span aria-current="page">{pageLabel}</span>
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  </section>
}
