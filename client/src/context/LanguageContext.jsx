import { createContext, useContext, useMemo, useState } from 'react'
import en from '../translations/en.js'
import fr from '../translations/fr.js'

const LanguageContext = createContext(null)
const dictionaries = { en, fr }

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('zayer-digital-language') || 'en')
  const value = useMemo(() => ({
    language,
    setLanguage: (next) => {
      localStorage.setItem('zayer-digital-language', next)
      document.documentElement.lang = next
      setLanguage(next)
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
