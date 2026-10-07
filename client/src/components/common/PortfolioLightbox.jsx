import { useEffect } from 'react'
import { X } from 'lucide-react'
import { getProjectMedia } from '../cards/PortfolioMediaCard.jsx'

function youtubeEmbedUrl(id) {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`
}

export default function PortfolioLightbox({ project, onClose }) {
  const media = project ? getProjectMedia(project) : null

  useEffect(() => {
    if (!project) return undefined
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, project])

  if (!project || !media) return null
  const mediaElement = media.type === 'youtube'
    ? <iframe
      src={youtubeEmbedUrl(media.youtubeId)}
      title={project.title}
      className="legacy-lightbox-iframe"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
    : media.type === 'video'
      ? <video className="legacy-lightbox-media" src={media.url} controls autoPlay playsInline />
      : <img className="legacy-lightbox-media" src={media.url} alt={project.title} />

  return <div className="legacy-lightbox" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <div className="legacy-lightbox-inner" role="dialog" aria-modal="true" aria-label={project.title}>
      <button className="legacy-lightbox-close" type="button" aria-label="Close preview" onClick={onClose}><X size={24} /></button>
      {mediaElement}
      <p>{project.title}</p>
    </div>
  </div>
}
