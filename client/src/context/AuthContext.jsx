import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AUTH_TOKEN_KEY, setUnauthorizedHandler } from '../services/api.js'
import { authService } from '../services/authService.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const clearAuthentication = useCallback(() => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(clearAuthentication)
    return () => setUnauthorizedHandler(null)
  }, [clearAuthentication])

  useEffect(() => {
    let active = true
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return () => { active = false }
    }

    authService.getMe()
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        if (active) clearAuthentication()
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [clearAuthentication])

  const login = useCallback(async (credentials) => {
    setLoading(true)
    try {
      const { user: authenticatedUser, token } = await authService.login(credentials)
      window.localStorage.setItem(AUTH_TOKEN_KEY, token)
      setUser(authenticatedUser)
      return authenticatedUser
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback((details) => authService.register(details), [])
  const logout = useCallback(() => {
    clearAuthentication()
  }, [clearAuthentication])

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    loading,
    login,
    register,
    logout,
  }), [user, loading, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
