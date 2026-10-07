import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Hero({ video, label, title, description, primary, secondary, stats, compact = false, revealOnScroll = false }) {
  const [hasScrolled, setHasScrolled] = useState(false)
  const videoSrc = video ? `/videos/${video}` : null

  useEffect(() => {
    if (!revealOnScroll) return undefined
    const handleScroll = () => {
      if (window.scrollY > 12) {
        setHasScrolled(true)
        window.removeEventListener('scroll', handleScroll)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [revealOnScroll])

  return <section className={`hero ${compact ? 'hero-compact' : ''} ${video ? 'hero-video' : ''}`} id="top">
    {video && <div className="hero-video-layer" aria-hidden="true">
      {videoSrc && <video autoPlay muted loop playsInline preload="none" aria-hidden="true"><source src={videoSrc} type="video/mp4" /></video>}
    </div>}
    <div className="hero-shade" />
    <div className={`container hero-content ${revealOnScroll ? 'home-hero-content' : ''} ${hasScrolled ? 'is-scroll-revealed' : ''}`}>
      <span className="eyebrow hero-eyebrow"><span className="eyebrow-line" />{label}</span>
      <h1>{title}</h1>
      {description && <p className="hero-description">{description}</p>}
      <div className="hero-buttons">
        {primary && <Link className="button button-gold" to={primary.to}>{primary.label}<ArrowUpRight size={17} /></Link>}
        {secondary && <Link className="button button-outline" to={secondary.to}>{secondary.label}<ArrowUpRight size={17} /></Link>}
      </div>
    </div>
    {stats && <div className="hero-stats">{stats.map((stat) => <div className="hero-stat" key={stat.value}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>}
    {!compact && <a className="hero-scroll" href="#services"><span>SCROLL TO EXPLORE</span><ArrowDown size={15} /></a>}
  </section>
}
