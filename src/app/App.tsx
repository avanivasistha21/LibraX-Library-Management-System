import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/shell'
import { DashboardPage } from '@/pages/dashboard'
import { CataloguePage } from '@/pages/catalogue'
import { LoginPage } from '@/pages/login'
import { CopiesPage, PeoplePage, MetadataPage, CirculationPage, ReservationsPage, FinesPage, HistoryPage, AnalyticsPage, SettingsPage } from '@/pages/operations'
import { useSession } from './session'
import { LoadingState } from '@/components/ui'
import type { Role } from '@/types'

function RequireSession() {
  const { user, loading } = useSession()
  if (loading) return <LoadingState label="Restoring your secure session…" />
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useSession()
  return role && roles.includes(role) ? children : <Navigate to="/" replace />
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<RequireSession />}>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/catalogue" element={<CataloguePage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/fines" element={<FinesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/copies" element={<RoleRoute roles={['admin', 'librarian']}><CopiesPage /></RoleRoute>} />
        <Route path="/people" element={<RoleRoute roles={['admin', 'librarian']}><PeoplePage /></RoleRoute>} />
        <Route path="/metadata" element={<RoleRoute roles={['admin']}><MetadataPage /></RoleRoute>} />
        <Route path="/circulation" element={<RoleRoute roles={['admin', 'librarian']}><CirculationPage /></RoleRoute>} />
        <Route path="/analytics" element={<RoleRoute roles={['admin', 'librarian']}><AnalyticsPage /></RoleRoute>} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
