export default function ProcessStep({ item, index }) {
  return <article className="process-step"><span className="process-number">{String(index + 1).padStart(2, '0')}</span><div className="process-marker"><span /></div><h3>{item[0]}</h3><p>{item[1]}</p></article>
}
