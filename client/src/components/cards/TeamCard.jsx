import { useLanguage } from '../../context/LanguageContext.jsx'

export default function TeamCard({ person }) {
  const { language } = useLanguage()

  return <article className="legacy-team-card">
    <div className="legacy-team-portrait"><span>{person.initials}</span></div>
    <div className="legacy-team-copy">
      <h3>{person.name}</h3>
      <span>{language === 'fr' ? person.roleFr : person.role}</span>
      <p>{language === 'fr' ? person.bioFr : person.bio}</p>
    </div>
  </article>
}
