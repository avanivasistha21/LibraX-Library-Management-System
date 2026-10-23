import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AuthUser, Role } from '@/types'
import { clearAuthToken, getAuthToken, setAuthToken } from '@/services/api'
import * as authApi from '@/services/api'

interface Session {
  user: AuthUser | null
  role: Role | null
  name: string
  email: string
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(Boolean(getAuthToken()))

  useEffect(() => {
    if (!getAuthToken()) return
    authApi.getCurrentUser()
      .then(setUser)
      .catch(() => { clearAuthToken(); setUser(null) })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    queryClient.clear()
    setAuthToken(result.token)
    setUser(result.user)
  }

  const signOut = () => {
    void authApi.logout().catch(() => undefined)
    queryClient.clear()
    clearAuthToken()
    setUser(null)
  }

  const value = useMemo(() => ({
    user,
    role: user?.role ?? null,
    name: user?.name ?? '',
    email: user?.email ?? '',
    loading,
    login,
    signOut,
  }), [user, loading])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside SessionProvider')
  return context
}
