import { useEffect } from 'react'

export default function PageMeta({ title, description }) {
  useEffect(() => {
    const brandPattern = /\bzayer\s*\.?\s*digital\b/i
    const brandSuffixPattern = /\s*(?:\||—|-)\s*zayer\s*\.?\s*digital\s*$/i
    let pageTitle = String(title || '').trim()

    while (brandSuffixPattern.test(pageTitle)) {
      pageTitle = pageTitle.replace(brandSuffixPattern, '').trim()
    }

    document.title = brandPattern.test(pageTitle)
      ? pageTitle
      : `${pageTitle} | ZAYER Digital`
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = description
  }, [title, description])
  return null
}
