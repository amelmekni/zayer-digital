import { useEffect, useState } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import LanguageSwitcher from '../common/LanguageSwitcher.jsx'

const routes = [['home', '/'], ['about', '/about'], ['services', '/services'], ['portfolio', '/portfolio'], ['careers', '/careers']]

export default function Navbar() {
  const { t } = useLanguage()
  const { user, logout } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  useEffect(() => setOpen(false), [location.pathname, location.hash])
  useEffect(() => {
    document.body.classList.toggle('menu-open', open)
    return () => document.body.classList.remove('menu-open')
  }, [open])

  return <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
    <div className="nav-shell">
      <Link className="brand" to="/" aria-label="ZAYER.Digital home">
        <span className="brand-name">ZAYER<span className="brand-dot">.</span><span className="brand-word">Digital</span></span>
      </Link>
      <nav className={`primary-nav ${open ? 'nav-open' : ''}`} aria-label="Main navigation">
        {routes.map(([key, to]) => key === 'services'
          ? <Link key={to} to={to} className={`nav-link ${location.pathname === '/services' ? 'active' : ''}`}>{t.nav[key]}</Link>
          : <NavLink key={to} to={to} end={to === '/'}>{t.nav[key]}</NavLink>)}
        {user
          ? <button className="mobile-contact mobile-auth-action" type="button" onClick={logout}>{t.auth.logoutAction}</button>
          : <Link className="mobile-contact mobile-auth-action" to="/login">{t.auth.loginAction}<ArrowUpRight size={16} /></Link>}
        <Link className="mobile-contact" to="/contact">{t.nav.contact}<ArrowUpRight size={16} /></Link>
        <div className="mobile-language"><LanguageSwitcher /></div>
      </nav>
      <div className="nav-actions">
        <LanguageSwitcher />
        {user
          ? <button className="nav-account" type="button" onClick={logout}>{t.auth.logoutAction}</button>
          : <Link className="nav-account" to="/login">{t.auth.loginAction}</Link>}
        <Link className="button button-nav" to="/contact">{t.nav.contact}<ArrowUpRight size={15} /></Link>
      </div>
      <button className="menu-toggle" type="button" aria-label={open ? t.nav.close : t.nav.menu} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
    </div>
  </header>
}
