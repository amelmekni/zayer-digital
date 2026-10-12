export function isTokenVersionCurrent(tokenVersion, currentTokenVersion) {
  return (tokenVersion || 0) === (currentTokenVersion || 0)
}
