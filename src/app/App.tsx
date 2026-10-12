import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/shell'
import { DashboardPage } from '@/pages/dashboard'
import { CataloguePage } from '@/pages/catalogue'
import { LoginPage } from '@/pages/login'
import { CopiesPage, PeoplePage, MetadataPage, CirculationPage, ReservationsPage, FinesPage, HistoryPage, AnalyticsPage, SettingsPage } from '@/pages/operations'

export default function App() { return <Routes><Route path="/login" element={<LoginPage />} /><Route element={<AppShell />}><Route path="/" element={<DashboardPage />} /><Route path="/catalogue" element={<CataloguePage />} /><Route path="/copies" element={<CopiesPage />} /><Route path="/people" element={<PeoplePage />} /><Route path="/metadata" element={<MetadataPage />} /><Route path="/circulation" element={<CirculationPage />} /><Route path="/reservations" element={<ReservationsPage />} /><Route path="/fines" element={<FinesPage />} /><Route path="/history" element={<HistoryPage />} /><Route path="/analytics" element={<AnalyticsPage />} /><Route path="/settings" element={<SettingsPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes> }
