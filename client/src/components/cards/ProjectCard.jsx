import { ArrowUpRight } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function ProjectCard({ project }) {
  const { language, t } = useLanguage()
  const title = typeof project.title === 'string' ? project.title : project.title?.[language] || project.slug
  const description = typeof project.description === 'string' ? project.description : project.description?.[language] || ''
  const technologies = project.technologies || project.tech || []
  return <article className="project-card">
    <div className="project-image-wrap"><img src={project.image} alt={title} loading="lazy" />{project.isConcept && <span className="demo-badge">{t.common.demo}</span>}<span className="project-image-arrow"><ArrowUpRight size={20} /></span></div>
    <div className="project-card-copy"><span className="project-category">{t.categories[project.category] || project.category}</span><h3>{title}</h3><p>{description}</p><div className="tag-list">{technologies.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div></div>
  </article>
}
