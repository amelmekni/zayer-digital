export function LoadingState({ label = 'Loading...' }) {
  return <p className="api-state" role="status" aria-live="polite">{label}</p>
}

export function ErrorState({ message, onRetry }) {
  return <div className="api-state api-state-error" role="alert">
    <p>{message}</p>
    {onRetry && <button className="text-link" type="button" onClick={onRetry}>Try again</button>}
  </div>
}

export function EmptyState({ message }) {
  return <p className="api-state">{message}</p>
}
