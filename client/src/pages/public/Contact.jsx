import { useRef, useState } from 'react'
import { ArrowUpRight, Clock3, Globe2, Mail, MapPin, Phone } from 'lucide-react'
import LegacyPageHero from '../../components/sections/LegacyPageHero.jsx'
import Toast from '../../components/common/Toast.jsx'
import Reveal from '../../components/common/Reveal.jsx'
import PageMeta from '../../components/common/PageMeta.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { contactService } from '../../services/contactService.js'

export default function Contact() {
  const { t } = useLanguage()
  const content = t.legacy.contact
  const [toast, setToast] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const submitLock = useRef(false)

  const submit = async (event) => {
    event.preventDefault()
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    setSubmitError('')

    const form = event.currentTarget
    const values = new FormData(form)
    const payload = {
      name: `${String(values.get('firstName') || '').trim()} ${String(values.get('lastName') || '').trim()}`.trim(),
      email: String(values.get('email') || '').trim(),
      phone: String(values.get('phone') || '').trim(),
      company: String(values.get('company') || '').trim(),
      subject: 'New inquiry from zayerdigital.tn',
      message: String(values.get('message') || '').trim(),
    }

    try {
      await contactService.createContact(payload)
      form.reset()
      setToast(content.success)
      window.setTimeout(() => setToast(''), 5000)
    } catch (requestError) {
      setSubmitError(requestError.message)
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return <>
    <PageMeta title="Contact ZAYER Digital" description={content.intro} />
    <LegacyPageHero
      pageLabel={content.breadcrumb}
      title={<>{content.title[0]}<br />{content.title[1].split(' ').slice(0, -1).join(' ')} <em>{content.title[1].split(' ').at(-1)}</em></>}
      description={content.intro}
    />

    <section className="legacy-contact-main">
      <div className="container legacy-contact-grid">
        <Reveal className="legacy-contact-info">
          <span className="legacy-eyebrow">{content.infoEyebrow}</span>
          <h2>{content.infoTitle[0]}<br />{content.infoTitle[1]}</h2>
          <p className="legacy-contact-intro">{content.infoCopy}</p>
          <div className="legacy-contact-details">
            <ContactDetail icon={<Mail size={19} />} label={content.emailAddress}>
              <a href={`mailto:${content.emailAddressValue}`}>{content.emailAddressValue}</a>
            </ContactDetail>
            <ContactDetail icon={<Phone size={19} />} label={content.phone}>
              {content.phones.map(([label, href], index) => <span key={href}>
                {index > 0 && <i> | </i>}<a href={`tel:${href}`}>{label}</a>
              </span>)}
            </ContactDetail>
            <ContactDetail icon={<Globe2 size={19} />} label={content.website}>
              <a href={content.websiteHref} target="_blank" rel="noopener noreferrer">{content.websiteValue}</a>
            </ContactDetail>
            <ContactDetail icon={<MapPin size={19} />} label={content.location}>
              <span>{content.locationValue}{content.global && <small>{content.global}</small>}</span>
            </ContactDetail>
          </div>

          <div className="legacy-social-block">
            <span className="legacy-eyebrow">{content.follow}</span>
            <div className="legacy-social-row">{content.socials.map(([label, href]) =>
              <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>,
            )}</div>
          </div>

          <div className="legacy-hours">
            <h3><Clock3 size={18} />{content.hoursTitle}</h3>
            <div><span>{content.weekdays}</span><strong>{content.weekdaysHours}</strong></div>
            <div><span>{content.saturday}</span><strong>{content.saturdayHours}</strong></div>
            <div><span>{content.sunday}</span><strong>{content.closed}</strong></div>
          </div>
        </Reveal>

        <Reveal>
          <div className="legacy-contact-form-wrap">
            <h3>{content.formTitle}</h3><p>{content.formCopy}</p>
            <form onSubmit={submit}>
              <div className="legacy-form-row">
                <label className="legacy-field"><span>{content.firstName} *</span><input name="firstName" autoComplete="given-name" required /></label>
                <label className="legacy-field"><span>{content.lastName} *</span><input name="lastName" autoComplete="family-name" required /></label>
              </div>
              <div className="legacy-form-row">
                <label className="legacy-field"><span>{content.email} *</span><input name="email" type="email" autoComplete="email" required /></label>
                <label className="legacy-field"><span>{content.phoneLabel}</span><input name="phone" type="tel" autoComplete="tel" /></label>
              </div>
              <label className="legacy-field"><span>{content.company}</span><input name="company" autoComplete="organization" /></label>
              <label className="legacy-field"><span>{content.message} *</span><textarea name="message" rows="5" required /></label>
              {submitError && <p className="legacy-form-error" role="alert">{submitError}</p>}
              <button className="legacy-button legacy-button-gold" type="submit" disabled={submitting}>
                {submitting ? t.contact.submitting : content.send}<ArrowUpRight size={17} />
              </button>
              <p className="legacy-form-disclaimer">{content.disclaimer}</p>
            </form>
          </div>
        </Reveal>
      </div>
    </section>
    <Toast message={toast} onClose={() => setToast('')} />
  </>
}

function ContactDetail({ icon, label, children }) {
  return <div className="legacy-contact-detail">
    <span className="legacy-contact-icon">{icon}</span>
    <div><span className="legacy-contact-label">{label}</span><div className="legacy-contact-value">{children}</div></div>
  </div>
}
