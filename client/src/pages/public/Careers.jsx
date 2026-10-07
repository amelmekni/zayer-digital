import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, HeartHandshake, Laptop, Trophy, X } from 'lucide-react'
import LegacyPageHero from '../../components/sections/LegacyPageHero.jsx'
import Toast from '../../components/common/Toast.jsx'
import Reveal from '../../components/common/Reveal.jsx'
import PageMeta from '../../components/common/PageMeta.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { jobService } from '../../services/jobService.js'
import { applicationService } from '../../services/applicationService.js'
import { useApiResource } from '../../hooks/useApiResource.js'
import { ErrorState, LoadingState } from '../../components/common/ApiStates.jsx'

const perkIcons = [Laptop, BookOpen, Trophy, HeartHandshake]

function departmentMatches(job, filter) {
  if (filter === 'all') return true
  const department = String(job.department || '').toLowerCase()
  if (filter === 'Tech') return department.includes('tech') || department.includes('develop')
  if (filter === 'Strategy') return department.includes('strateg')
  return department.includes(filter.toLowerCase())
}

function ApplicationForm({ content, job, submitting, error, onSubmit }) {
  const fields = content.application

  return <form className="legacy-application-form" onSubmit={onSubmit}>
    <div className="legacy-form-row">
      <label className="legacy-field"><span>{fields.firstName} *</span><input name="firstName" autoComplete="given-name" required /></label>
      <label className="legacy-field"><span>{fields.lastName} *</span><input name="lastName" autoComplete="family-name" required /></label>
    </div>
    <div className="legacy-form-row">
      <label className="legacy-field"><span>{fields.email} *</span><input name="email" type="email" autoComplete="email" required /></label>
      <label className="legacy-field"><span>{fields.phone}</span><input name="phone" type="tel" autoComplete="tel" /></label>
    </div>
    <label className="legacy-field"><span>{fields.message}</span><textarea name="message" rows="3" /></label>
    <label className="legacy-cv-upload">
      <span>{fields.cv} *</span>
      <input name="cv" type="url" placeholder="https://" maxLength="2048" required />
      <small>{fields.cvHint}</small>
    </label>
    {error && <p className="legacy-form-error" role="alert">{error}</p>}
    <button className="legacy-button legacy-button-gold" type="submit" disabled={submitting}>
      {submitting ? fields.submitting : fields.submit}<ArrowUpRight size={16} />
    </button>
    {job && <input type="hidden" name="job" value={job._id} />}
  </form>
}

export default function Careers() {
  const { t } = useLanguage()
  const content = t.legacy.careers
  const [filter, setFilter] = useState('all')
  const [selectedJob, setSelectedJob] = useState(null)
  const [toast, setToast] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const submitLock = useRef(false)
  const loadJobs = useCallback(() => jobService.getJobs(), [])
  const { data: jobs, loading, error, reload } = useApiResource(loadJobs, [loadJobs])
  const filteredJobs = (jobs || []).filter((job) => departmentMatches(job, filter))

  useEffect(() => {
    if (!selectedJob) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedJob(null)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedJob])

  const submitApplication = async (event) => {
    event.preventDefault()
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    setSubmitError('')

    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = {
      firstName: String(formData.get('firstName') || '').trim(),
      lastName: String(formData.get('lastName') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      message: String(formData.get('message') || '').trim(),
      cv: String(formData.get('cv') || '').trim(),
    }
    if (selectedJob?._id) payload.job = selectedJob._id

    try {
      await applicationService.createApplication(payload)
      form.reset()
      setSelectedJob(null)
      setToast(content.application.success)
      window.setTimeout(() => setToast(''), 5000)
    } catch (requestError) {
      setSubmitError(requestError.message)
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return <>
    <PageMeta title="Careers at ZAYER Digital" description={content.intro} />
    <LegacyPageHero
      pageLabel={content.breadcrumb}
      title={<>{content.title[0]}<br />{content.title[1].replace('ZAYER Digital', '')}<em>{content.title[1].includes('ZAYER Digital') ? 'ZAYER Digital' : ''}</em></>}
      description={content.intro}
    />

    <section className="legacy-careers-life">
      <div className="container legacy-careers-grid">
        <Reveal>
          <span className="legacy-eyebrow">{content.lifeEyebrow}</span>
          <h2>{content.lifeTitle}</h2>
          <p className="legacy-careers-copy">{content.lifeCopy}</p>
          <div className="legacy-perks-grid">
            {content.perks.map(([title, description], index) => {
              const Icon = perkIcons[index]
              return <article className="legacy-perk" key={title}>
                <Icon size={18} strokeWidth={1.6} />
                <div><h3>{title}</h3><p>{description}</p></div>
              </article>
            })}
          </div>
        </Reveal>
        <Reveal>
          <blockquote className="legacy-careers-quote">{content.quote}</blockquote>
          <div className="legacy-careers-stats">
            {content.stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
          </div>
        </Reveal>
      </div>
    </section>

    <section className="legacy-section legacy-jobs">
      <div className="container">
        <Reveal className="legacy-section-header">
          <div><span className="legacy-eyebrow">{content.jobsEyebrow}</span><h2>{content.jobsTitle}</h2></div>
          {!loading && !error && <span className="legacy-role-count">{jobs?.length || 0} {content.openRoles}</span>}
        </Reveal>
        <div className="legacy-filter-row" role="group" aria-label={content.jobsEyebrow}>
          {content.filters.map(([key, label]) => <button
            type="button"
            key={key}
            className={filter === key ? 'active' : ''}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >{label}</button>)}
        </div>
        {loading && <LoadingState label={t.common.loading} />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && filteredJobs.length === 0 && <p className="legacy-empty-state">{content.noJobs}</p>}
        {!loading && !error && filteredJobs.length > 0 && <div className="legacy-job-list">
          {filteredJobs.map((job) => <button
            className="legacy-job-card"
            type="button"
            key={job._id || job.slug}
            onClick={() => { setSubmitError(''); setSelectedJob(job) }}
          >
            <span>
              <strong>{job.title}</strong>
              <span className="legacy-job-meta">
                <span>📍 {job.location}</span>{job.experience && <span>{job.experience}</span>}
              </span>
            </span>
            <span className="legacy-job-apply">{content.apply}</span>
          </button>)}
        </div>}
      </div>
    </section>

    <section className="legacy-open-application">
      <div className="legacy-open-application-inner">
        <h2>{content.cvTitle}</h2>
        <p>{content.cvCopy}</p>
        <ApplicationForm content={content} submitting={submitting} error={submitError} onSubmit={submitApplication} />
      </div>
    </section>

    {selectedJob && <div className="legacy-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setSelectedJob(null)
    }}>
      <section className="legacy-job-modal" role="dialog" aria-modal="true" aria-labelledby="job-modal-title">
        <button className="legacy-modal-close" type="button" aria-label={t.nav.close} onClick={() => setSelectedJob(null)}><X size={21} /></button>
        <span className="legacy-eyebrow">{selectedJob.department}</span>
        <h2 id="job-modal-title">{selectedJob.title}</h2>
        <div className="legacy-job-meta legacy-job-modal-meta">
          <span>📍 {selectedJob.location}</span>
          {selectedJob.experience && <span>{selectedJob.experience}</span>}
        </div>
        <p>{selectedJob.description}</p>
        {selectedJob.responsibilities?.length > 0 && <div className="legacy-job-details">
          <h3>{content.responsibilities}</h3>
          <ul>{selectedJob.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>}
        {selectedJob.requirements?.length > 0 && <div className="legacy-job-details">
          <h3>{content.requirements}</h3>
          <ul>{selectedJob.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>}
        <h3 className="legacy-application-heading">{content.roleApplicationTitle}</h3>
        <ApplicationForm
          content={content}
          job={selectedJob}
          submitting={submitting}
          error={submitError}
          onSubmit={submitApplication}
        />
      </section>
    </div>}
    <Toast message={toast} onClose={() => setToast('')} />
  </>
}
