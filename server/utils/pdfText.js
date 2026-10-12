export function pdfSafeText(value) {
  const replacements = new Map([
    ['\u2018', "'"], ['\u2019', "'"], ['\u201C', '"'], ['\u201D', '"'],
    ['\u2013', '-'], ['\u2014', '-'], ['\u2026', '...'], ['\u20AC', 'EUR'],
  ])
  return Array.from(String(value ?? ''), (character) => {
    const replacement = replacements.get(character)
    if (replacement) return replacement
    const code = character.codePointAt(0)
    if (code >= 32 && code <= 255) return character
    if (code > 255) {
      const decomposed = character.normalize('NFKD').replace(/\p{M}/gu, '')
      return Array.from(decomposed).every((part) => part.codePointAt(0) <= 255) ? decomposed : '?'
    }
    return code === 9 || code === 10 || code === 13 ? character : ''
  }).join('')
}
