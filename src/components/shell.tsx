import { BookCopy, BookOpen, Boxes, CircleDollarSign, FileClock, FlaskConical, KeyRound, LayoutDashboard, LibraryBig, LogOut, Menu, Moon, Sun, Tags, Users, X } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Role } from '@/types'
import { useSession } from '@/app/session'
import { Avatar, IconButton } from './ui'

const sections = [
  { label: 'Workspace', items: [{ to: '/', label: 'Overview', icon: LayoutDashboard }, { to: '/catalogue', label: 'Book catalogue', icon: BookOpen }, { to: '/reservations', label: 'Reservations', icon: Boxes }] },
  { label: 'Library operations', items: [{ to: '/copies', label: 'Physical copies', icon: BookCopy, roles: ['admin', 'librarian'] as Role[] }, { to: '/people', label: 'Members & staff', icon: Users, roles: ['admin'] as Role[] }, { to: '/metadata', label: 'Metadata', icon: Tags, roles: ['admin'] as Role[] }, { to: '/circulation', label: 'Issue & return', icon: LibraryBig, roles: ['admin', 'librarian'] as Role[] }, { to: '/fines', label: 'Fines & payments', icon: CircleDollarSign }, { to: '/history', label: 'Borrowing history', icon: FileClock }, { to: '/analytics', label: 'Analytics', icon: FlaskConical, roles: ['admin', 'librarian'] as Role[] }] },
  { label: 'Account', items: [{ to: '/settings', label: 'Security settings', icon: KeyRound }] },
]
const roleLabels: Record<Role, string> = { admin: 'Administrator', librarian: 'Librarian', member: 'Member' }
type Theme = 'light' | 'dark'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('librax-theme') as Theme | null) ?? 'light')
  const { role, name, email, signOut } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => { document.documentElement.classList.toggle('theme-dark', theme === 'dark'); localStorage.setItem('librax-theme', theme) }, [theme])
  if (!role) return null
  const visibleSections = sections.map((section) => ({ ...section, items: section.items.filter((item) => !item.roles || item.roles.includes(role)) })).filter((section) => section.items.length > 0)
  const title = visibleSections.flatMap((section) => section.items).find((item) => item.to === location.pathname)?.label ?? 'Account settings'
  const tone = role === 'admin' ? '#B9563E' : role === 'librarian' ? '#667A62' : '#7E6A98'
  return <div className="min-h-screen bg-canvas text-ink"><div className="flex min-h-screen">
    <aside className={(mobileOpen ? 'translate-x-0 ' : '-translate-x-full ') + 'fixed inset-y-0 left-0 z-40 flex w-[266px] flex-col border-r border-line bg-[#F8F5F0] transition-transform duration-200 lg:static lg:translate-x-0'}>
      <div className="flex h-[82px] items-center justify-between border-b border-line px-6"><button onClick={() => navigate('/')} className="flex items-center gap-3 text-left"><span className="brand-logo"><img src="/librax-logo.png" alt="LibraX logo" /></span><span><span className="font-display text-lg font-semibold tracking-[-0.04em]">LibraX</span><span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Library intelligence</span></span></button><IconButton label="Close navigation" className="lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></IconButton></div>
      <nav className="flex-1 overflow-y-auto px-4 py-5">{visibleSections.map((section) => <div key={section.label} className="mb-7"><p className="label px-3 text-slate-400">{section.label}</p><div className="mt-2 space-y-1">{section.items.map((item) => { const Icon = item.icon; return <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}><Icon className="h-[17px] w-[17px]" strokeWidth={1.8} /><span>{item.label}</span></NavLink> })}</div></div>)}</nav>
      <div className="border-t border-line p-4"><div className="flex items-center gap-3"><Avatar name={name} tone={tone} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-ink">{name}</p><p className="truncate text-[11px] text-slate-400">{roleLabels[role]}</p><p className="truncate text-[10px] text-slate-400">{email}</p></div><IconButton label="Sign out" onClick={() => { signOut(); navigate('/login', { replace: true }) }}><LogOut className="h-4 w-4" /></IconButton></div></div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-30 flex h-[82px] items-center justify-between border-b border-line bg-canvas/90 px-5 backdrop-blur-md lg:px-9"><div className="flex items-center gap-3"><IconButton label="Open navigation" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></IconButton><div><div className="hidden items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 sm:flex"><span>LibraX</span><span>/</span><span>{title}</span></div><h1 className="font-display text-xl font-semibold tracking-[-0.04em] text-ink sm:mt-1">{title}</h1></div></div><div className="flex items-center gap-3"><span className="hidden text-xs font-semibold text-slate-500 sm:inline">{roleLabels[role]}</span><IconButton label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}</IconButton></div></header>
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-5 py-7 lg:px-9 lg:py-9"><Outlet /></main>
    </div>
  </div>{mobileOpen && <button className="fixed inset-0 z-30 bg-ink/20 lg:hidden" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} />}</div>
}
