import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '@/types'

interface Session { role: Role; name: string; email: string; setRole: (role: Role) => void; signOut: () => void }
const SessionContext = createContext<Session | null>(null)
const roleInfo: Record<Role, { name: string; email: string }> = { admin: { name: 'Maya Iyer', email: 'maya@librax.edu' }, librarian: { name: 'Arjun Rao', email: 'arjun@librax.edu' }, member: { name: 'Avani Vasistha', email: 'avani@librax.edu' } }
export function SessionProvider({ children }: { children: ReactNode }) { const [role, setRole] = useState<Role>('admin'); const value = useMemo(() => ({ role, ...roleInfo[role], setRole, signOut: () => setRole('member') }), [role]); return <SessionContext.Provider value={value}>{children}</SessionContext.Provider> }
export function useSession() { const context = useContext(SessionContext); if (!context) throw new Error('useSession must be used inside SessionProvider'); return context }
