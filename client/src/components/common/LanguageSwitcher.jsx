import { useLanguage } from '../../context/LanguageContext.jsx'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()
  return <div className="language-switch" aria-label="Language">
    {['en', 'fr'].map((lang, i) => <span key={lang}>
      {i > 0 && <span className="language-divider" aria-hidden="true">/</span>}
      <button type="button" className={language === lang ? 'selected' : ''} aria-pressed={language === lang} onClick={() => setLanguage(lang)}>{lang.toUpperCase()}</button>
    </span>)}
  </div>
}
