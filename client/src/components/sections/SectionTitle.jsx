export default function SectionTitle({ eyebrow, title, description, light = false, centered = false }) {
  return <div className={`section-title ${light ? 'section-title-light' : ''} ${centered ? 'section-title-center' : ''}`}>
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
    <h2>{title}</h2>
    {description && <p>{description}</p>}
  </div>
}
