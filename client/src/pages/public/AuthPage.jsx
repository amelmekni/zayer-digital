import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login'
  const { isAuthenticated, loading, login, register } = useAuth()
  const { t } = useLanguage()
  const copy = t.auth
  const location = useLocation()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setError('')
    setSuccess('')
  }, [mode])

  if (!loading && isAuthenticated) return <Navigate to="/" replace />

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    const fields = new FormData(event.currentTarget)
    const form = event.currentTarget
    const details = Object.fromEntries(fields.entries())

    try {
      if (isLogin) {
        await login({ email: details.email, password: details.password })
        navigate(location.state?.from?.pathname || '/', { replace: true })
      } else {
        await register({ name: details.name, email: details.email, password: details.password })
        setSuccess(copy.registerSuccess)
        form.reset()
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="auth-page">
    <div className="auth-card">
      <span className="eyebrow">{copy.eyebrow}</span>
      <h1>{isLogin ? copy.loginTitle : copy.registerTitle}</h1>
      <p>{isLogin ? copy.loginIntro : copy.registerIntro}</p>
      <form className="form-card" onSubmit={submit}>
        {!isLogin && <label className="field"><span>{copy.name}</span><input name="name" autoComplete="name" minLength="2" maxLength="100" required /></label>}
        <label className="field"><span>{copy.email}</span><input name="email" type="email" autoComplete="email" required /></label>
        <label className="field"><span>{copy.password}</span><input name="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={isLogin ? undefined : 12} required /></label>
        {error && <p className="form-message form-message-error" role="alert">{error}</p>}
        {success && <p className="form-message form-message-success" role="status">{success}</p>}
        <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? copy.working : isLogin ? copy.loginAction : copy.registerAction}</button>
      </form>
      <p className="auth-switch">{isLogin ? copy.noAccount : copy.hasAccount} <Link to={isLogin ? '/register' : '/login'}>{isLogin ? copy.registerLink : copy.loginLink}</Link></p>
      {!isLogin && <p className="auth-note">{copy.registrationNote}</p>}
    </div>
  </section>
}
