import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { LoadingState } from './ApiStates.jsx'

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingState label="Checking your session..." />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  return children || <Outlet />
}

export function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingState label="Checking your session..." />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (user.role !== 'admin') {
    return <section className="not-found" role="alert"><span className="eyebrow">403 / ZAYER DIGITAL</span><h1>Access denied</h1><p>Your account does not have permission to view this page.</p></section>
  }
  return children || <Outlet />
}
