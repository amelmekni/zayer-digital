import { ArrowUpRight, MapPin, BriefcaseBusiness } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function JobCard({ job, onApply }) {
  const { t, language } = useLanguage()
  const typeNames = language === 'fr'
    ? { 'full-time': 'Temps plein', 'part-time': 'Temps partiel', contract: 'Contrat', internship: 'Stage', freelance: 'Freelance' }
    : { 'full-time': 'Full-time', 'part-time': 'Part-time', contract: 'Contract', internship: 'Internship', freelance: 'Freelance' }
  return <article className="job-card"><div className="job-name"><h3>{job.title}</h3><span>{typeNames[job.type] || job.type}</span></div><div className="job-meta"><span><MapPin size={15} />{job.location}</span><span><BriefcaseBusiness size={15} />{job.department}</span></div><button className="text-link" type="button" onClick={() => onApply(job)}>{t.common.apply}<ArrowUpRight size={16} /></button></article>
}
