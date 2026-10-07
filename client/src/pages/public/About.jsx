import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import LegacyPageHero from '../../components/sections/LegacyPageHero.jsx'
import TeamCard from '../../components/cards/TeamCard.jsx'
import Reveal from '../../components/common/Reveal.jsx'
import PageMeta from '../../components/common/PageMeta.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { team } from '../../data/team.js'

export default function About() {
  const { t } = useLanguage()
  const content = t.legacy.about

  return <>
    <PageMeta title="About ZAYER Digital" description={content.intro} />
    <LegacyPageHero
      pageLabel={content.breadcrumb}
      title={<>{content.title[0]}<br /><em>{content.title[1]}</em></>}
      description={content.intro}
    />

    <section className="legacy-mission">
      <div className="container legacy-mission-grid">
        <Reveal>
          <div className="legacy-mission-quote">
            <blockquote>{content.quote}</blockquote>
            <span>{content.quoteAttribution}</span>
          </div>
          <div className="legacy-mission-stats">
            {content.stats.map(([value, label]) => <div key={label}>
              <strong>{value}</strong><span>{label}</span>
            </div>)}
          </div>
        </Reveal>
        <Reveal className="legacy-mission-copy">
          <span className="legacy-eyebrow">{content.missionEyebrow}</span>
          <h2>{content.missionTitle}</h2>
          {content.mission.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </Reveal>
      </div>
    </section>

    <section className="legacy-section legacy-values">
      <div className="container">
        <Reveal className="legacy-centered-title">
          <span className="legacy-eyebrow">{content.valuesEyebrow}</span>
          <h2>{content.valuesTitle}</h2>
        </Reveal>
        <div className="legacy-values-grid">
          {content.values.map(([title, description], index) => <Reveal key={title} delay={index * 55}>
            <article className="legacy-value-card">
              <span className="legacy-card-number">{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3><p>{description}</p>
            </article>
          </Reveal>)}
        </div>
      </div>
    </section>

    <section className="legacy-section legacy-team">
      <div className="container">
        <Reveal className="legacy-section-header legacy-team-header">
          <div><span className="legacy-eyebrow">{content.teamEyebrow}</span><h2>{content.teamTitle}</h2></div>
        </Reveal>
        <div className="legacy-team-grid">
          {team.map((person) => <Reveal key={person.name}><TeamCard person={person} /></Reveal>)}
        </div>
      </div>
    </section>

    <section className="legacy-journey">
      <div className="container">
        <Reveal>
          <span className="legacy-eyebrow">{content.journeyEyebrow}</span>
          <h2>{content.journeyTitle}</h2>
        </Reveal>
        <div className="legacy-timeline">
          {content.journey.map(([year, title, description]) => <Reveal key={year}>
            <article className="legacy-timeline-item">
              <span className="legacy-timeline-year">{year}</span>
              <i aria-hidden="true" />
              <h3>{title}</h3><p>{description}</p>
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
