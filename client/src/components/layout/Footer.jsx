import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext.jsx'

const services = [
  'SEO & Content',
  'Social Media',
  'Paid Ads',
]

export default function Footer() {
  const { t } = useLanguage()
  const footer = t.legacy.footer

  return <footer className="legacy-footer">
    <div className="container legacy-footer-top">
      <div className="legacy-footer-brand">
        <Link className="legacy-logo" to="/" aria-label="ZAYER.Digital home">ZAYER<span>.</span>Digital</Link>
        <p>{t.legacy.home.footerDescription}</p>
      </div>
      <div className="legacy-footer-column">
        <h3>{footer.company}</h3>
        <Link to="/about">{footer.about}</Link>
        <Link to="/portfolio">{footer.portfolio}</Link>
        <Link to="/careers">{footer.careers}</Link>
        <Link to="/contact">{footer.contact}</Link>
        <Link to="/privacy">{footer.privacy}</Link>
      </div>
      <div className="legacy-footer-column">
        <h3>{footer.services}</h3>
        {services.map((service) => <Link key={service} to="/#services">{service}</Link>)}
      </div>
      <div className="legacy-footer-column">
        <h3>{footer.contactTitle}</h3>
        <a href={`mailto:${footer.email}`}>{footer.email}</a>
        <div className="legacy-footer-phones">{footer.phones.map(([label, href]) => <a key={href} href={`tel:${href}`}>{label}</a>)}</div>
        <a href={footer.websiteHref} target="_blank" rel="noopener noreferrer">{footer.website}</a>
        <p className="legacy-footer-location">{footer.location}</p>
      </div>
    </div>
    <div className="container legacy-footer-bottom">
      <p>© 2025 ZAYER Digital. {footer.copyright}</p>
      <div className="legacy-footer-socials">
        {footer.socials.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label === 'ig' ? 'Instagram: Zayer.Digital' : label}>{label}</a>)}
      </div>
    </div>
  </footer>
}
