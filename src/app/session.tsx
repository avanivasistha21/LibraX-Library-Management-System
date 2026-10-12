import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '@/types'
import { clearAuthToken, getAuthToken, setAuthToken } from '@/services/api'

interface Session {
  role: Role
  name: string
  email: string
  token: string | null
  setRole: (role: Role) => void
  setToken: (token: string | null) => void
  signOut: () => void
}

const SessionContext = createContext<Session | null>(null)

const roleInfo: Record<Role, { name: string; email: string }> = {
  admin: { name: 'Maya Iyer', email: 'maya@librax.edu' },
  librarian: { name: 'Arjun Rao', email: 'arjun@librax.edu' },
  member: { name: 'Avani Vasistha', email: 'avani@librax.edu' },
}

const ROLE_STORAGE_KEY = 'librax_user_role'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(ROLE_STORAGE_KEY) as Role | null
      if (saved && (saved === 'admin' || saved === 'librarian' || saved === 'member')) {
        return saved
      }
    }
    return 'admin'
  })

  const [token, setTokenState] = useState<string | null>(() => getAuthToken())

  const setRole = (newRole: Role) => {
    setRoleState(newRole)
    if (typeof window !== 'undefined') {
      localStorage.setItem(ROLE_STORAGE_KEY, newRole)
    }
  }

  const setToken = (newToken: string | null) => {
    setTokenState(newToken)
    if (newToken) {
      setAuthToken(newToken)
    } else {
      clearAuthToken()
    }
  }

  const signOut = () => {
    clearAuthToken()
    setTokenState(null)
    setRole('member')
  }

  const value = useMemo(
    () => ({
      role,
      ...roleInfo[role],
      token,
      setRole,
      setToken,
      signOut,
    }),
    [role, token]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside SessionProvider')
  return context
}
