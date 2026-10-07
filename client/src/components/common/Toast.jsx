import { Check, X } from 'lucide-react'

export default function Toast({ message, onClose }) {
  if (!message) return null
  return <div className="toast" role="status" aria-live="polite"><span className="toast-check"><Check size={17} /></span><span>{message}</span><button type="button" aria-label="Dismiss notification" onClick={onClose}><X size={17} /></button></div>
}
