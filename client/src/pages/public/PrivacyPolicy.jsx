import { Link } from 'react-router-dom'
import LegacyPageHero from '../../components/sections/LegacyPageHero.jsx'
import PageMeta from '../../components/common/PageMeta.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function PrivacyPolicy() {
  const { t } = useLanguage()
  const content = t.privacyPolicy

  return <>
    <PageMeta title={content.title} description={content.intro} />
    <LegacyPageHero
      pageLabel={content.eyebrow}
      title={content.title}
      description={content.intro}
    />

    <section className="legacy-section legacy-values">
      <div className="container">
        <div className="legacy-centered-title">
          <span className="legacy-eyebrow">{content.sectionsEyebrow}</span>
          <h2>{content.sectionsTitle}</h2>
        </div>
        <div className="legacy-values-grid">
          {content.sections.map((section) => <article className="legacy-value-card" key={section.title}>
            <h3>{section.title}</h3>
            <p>{section.text}</p>
          </article>)}
          <article className="legacy-value-card">
            <h3>{content.contactTitle}</h3>
            <p>{content.contactText}</p>
            <a href={`mailto:${content.contactEmail}`}>{content.contactEmail}</a>
          </article>
        </div>
        <p className="legacy-form-disclaimer">{content.confirmationNote}</p>
        <Link className="legacy-inline-link" to="/contact">{content.contactLink}</Link>
      </div>
    </section>
  </>
}
