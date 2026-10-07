function youtubeId(value) {
  try {
    const url = new URL(value)
    if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || ''
    if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) {
      return url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).at(-1) || ''
    }
  } catch {
    return ''
  }
  return ''
}

export function getProjectMedia(project) {
  const url = project.mediaUrl || project.image || ''
  const videoPath = /\.(mp4|mov|webm)(?:$|[?#])/i.test(url)
  const isYoutube = Boolean(youtubeId(url))
  const type = project.mediaType || (isYoutube ? 'youtube' : videoPath ? 'video' : 'image')
  return { type, url, youtubeId: isYoutube ? youtubeId(url) : '' }
}

export function safeProjectLink(value) {
  if (!value) return ''
  try {
    const candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''
  } catch {
    return ''
  }
}

export default function PortfolioMediaCard({ project, section, onPreview, viewSite }) {
  const media = getProjectMedia(project)

  return <article className={`legacy-project-card legacy-project-${section}`}>
    {section !== 'web' && <h3>{project.title}</h3>}
    <button
      type="button"
      className="legacy-project-preview"
      onClick={() => onPreview(project)}
      aria-label={`${project.title} — ${viewSite}`}
    >
      {media.type === 'youtube'
        ? <img src={`https://img.youtube.com/vi/${media.youtubeId}/hqdefault.jpg`} alt={project.title} loading="lazy" />
        : media.type === 'video'
          ? <video src={media.url} muted preload="metadata" playsInline aria-label={project.title} />
          : <img src={media.url} alt={project.title} loading="lazy" />}
      {media.type !== 'image' && <span className="legacy-play-overlay" aria-hidden="true">▶</span>}
    </button>
    {section === 'web' && <h3>{project.title}</h3>}
    {project.sector && <span className="legacy-project-sector">{project.sector}</span>}
    {section === 'web' && safeProjectLink(project.linkUrl) && <a
      className="legacy-button legacy-button-navy legacy-view-site"
      href={safeProjectLink(project.linkUrl)}
      target="_blank"
      rel="noopener noreferrer"
    >{viewSite}</a>}
  </article>
}
