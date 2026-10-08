import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import en from '../translations/en.js'
import fr from '../translations/fr.js'

const LanguageContext = createContext(null)
const dictionaries = { en, fr }

function getStoredLanguage() {
  return localStorage.getItem('zayer-digital-language') === 'fr' ? 'fr' : 'en'
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getStoredLanguage)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo(() => ({
    language,
    setLanguage: (next) => {
      const nextLanguage = next === 'fr' ? 'fr' : 'en'
      localStorage.setItem('zayer-digital-language', nextLanguage)
      document.documentElement.lang = nextLanguage
      setLanguageState(nextLanguage)
    },
    t: dictionaries[language] || en,
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
