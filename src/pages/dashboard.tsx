import { Activity, ArrowUpRight, BookOpen, CalendarClock, CircleDollarSign, Clock3, Layers3, Plus, RotateCcw, UserPlus } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, ErrorState, SectionHeading, StatCard, LoadingState } from '@/components/ui'
import { useLibrary } from '@/hooks/useLibrary'
import { dashboardMetrics, formatCurrency, formatCompactDate, getBookTitle, getMemberName } from '@/lib/utils'
import { useSession } from '@/app/session'

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useLibrary()
  const { role } = useSession()
  const navigate = useNavigate()
  if (isLoading) return <LoadingState />
  if (isError || !data) return <ErrorState retry={() => void refetch()} />
  const metrics = dashboardMetrics(data)
  const currentLoans = data.borrows.filter((borrow) => borrow.status !== 'returned').slice(0, 4)
  const recentBorrows = [...data.borrows].sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()).slice(0, 5)
  const activeReservations = data.reservations.filter((item) => item.status === 'queued' || item.status === 'ready').slice(0, 3)
  const circulationData = Array.from({ length: 6 }, (_, index) => {
    const now = new Date()
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    const inMonth = (value?: string) => {
      if (!value) return false
      const date = new Date(value)
      return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
    }
    return {
      month: month.toLocaleDateString('en-IN', { month: 'short' }),
      issued: data.borrows.filter((borrow) => inMonth(borrow.issuedAt)).length,
      returned: data.borrows.filter((borrow) => inMonth(borrow.returnedAt)).length,
    }
  })

  return <div className="space-y-7 fade-up">
    {role !== 'member' && (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-[0_8px_24px_rgba(23,32,43,0.03)] sm:p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-clay">Quick Desk Operations</p>
          <h3 className="mt-0.5 text-base font-semibold text-ink">Circulation & Member Actions</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button size="sm" onClick={() => navigate('/circulation?action=issue')}>
            <Plus className="h-4 w-4" /> Issue book
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/circulation?action=return')}>
            <RotateCcw className="h-4 w-4" /> Collect / Return book
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/people?action=add')}>
            <UserPlus className="h-4 w-4" /> Add member
          </Button>
        </div>
      </div>
    )}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {role === 'member' ? (
        <>
          <StatCard
            label="Active loans"
            value={data.borrows.filter((b) => b.status !== 'returned').length}
            detail="Books currently borrowed"
            icon={<BookOpen className="h-5 w-5" />}
            tone="clay"
          />
          <StatCard
            label="Overdue loans"
            value={data.borrows.filter((b) => b.status === 'overdue').length}
            detail={data.borrows.filter((b) => b.status === 'overdue').length > 0 ? 'Requires return to library' : 'All loans on schedule'}
            icon={<Clock3 className="h-5 w-5" />}
            tone={data.borrows.filter((b) => b.status === 'overdue').length > 0 ? 'butter' : 'moss'}
          />
          <StatCard
            label="Your holds"
            value={data.reservations.filter((r) => r.status === 'ready' || r.status === 'queued').length}
            detail="Reservations queued or ready"
            icon={<Layers3 className="h-5 w-5" />}
            tone="butter"
          />
          <StatCard
            label="Outstanding fines"
            value={formatCurrency(metrics.finesDue)}
            detail={metrics.finesDue > 0 ? `${data.fines.filter((f) => f.status === 'unpaid').length} unpaid fine record(s)` : 'All dues cleared'}
            icon={<CircleDollarSign className="h-5 w-5" />}
            tone={metrics.finesDue > 0 ? 'ink' : 'moss'}
          />
        </>
      ) : (
        <>
          <StatCard label="Collection" value={metrics.totalTitles} detail={metrics.totalCopies + ' physical copies'} icon={<BookOpen className="h-5 w-5" />} tone="clay" />
          <StatCard label="Available copies" value={metrics.availableCopies} detail={metrics.utilization + '% currently in use'} icon={<Layers3 className="h-5 w-5" />} tone="moss" />
          <StatCard label="Overdue loans" value={metrics.overdueLoans} detail="Needs attention today" icon={<Clock3 className="h-5 w-5" />} tone="butter" />
          <StatCard label="Fines to collect" value={formatCurrency(metrics.finesDue)} detail={data.fines.filter((fine) => fine.status === 'unpaid').length + ' unpaid records'} icon={<CircleDollarSign className="h-5 w-5" />} tone="ink" />
        </>
      )}
    </section>

    <section className="rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,32,43,0.03)] sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <SectionHeading
          eyebrow={role === 'member' ? 'Your holds' : 'Reservation desk'}
          title={role === 'member' ? 'Your next reservations' : 'Next reservations'}
          action={<Link to="/reservations" className="inline-flex items-center gap-1 text-xs font-bold text-clay hover:underline">Open reservations <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
        />
        <div className="flex items-center gap-2 rounded-full bg-[#FBF3D9] px-3 py-1.5 text-xs font-bold text-[#967421]">
          <CalendarClock className="h-3.5 w-3.5" />{metrics.pendingReservations} waiting
        </div>
      </div>
      {activeReservations.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {activeReservations.map((reservation) => (
            <Link to="/reservations" key={reservation.id} className="group rounded-xl border border-line bg-[#FCFBF9] p-4 transition hover:-translate-y-0.5 hover:border-clay/40 hover:shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F8E8E3] text-clay">
                  <BookOpen className="h-4 w-4" />
                </span>
                <Badge tone={reservation.status === 'ready' ? 'green' : 'amber'}>{reservation.status}</Badge>
              </div>
              <p className="mt-4 truncate text-sm font-semibold text-ink">{getBookTitle(reservation.bookId, data.books)}</p>
              {role !== 'member' && (
                <p className="mt-1 truncate text-xs text-slate-500">
                  {getMemberName(reservation.memberId, data.members)} ? position #{reservation.queuePosition}
                </p>
              )}
              <p className="mt-4 text-[11px] font-semibold text-clay">
                {reservation.status === 'ready' ? 'Pickup window open' : 'Waiting for a copy'}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-fog p-5 text-sm text-slate-500">No active reservations.</p>
      )}
    </section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.75fr)]">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,32,43,0.03)] sm:p-6">
        <SectionHeading
          eyebrow={role === 'member' ? 'Your history' : 'Backend records'}
          title={role === 'member' ? 'Your borrowing activity over the last six months' : 'Circulation over the last six months'}
        />
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={circulationData} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="issuedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B9563E" stopOpacity={0.23} />
                  <stop offset="100%" stopColor="#B9563E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="returnedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#667A62" stopOpacity={0.17} />
                  <stop offset="100%" stopColor="#667A62" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#EEEAE3" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8C9298', fontSize: 11 }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#8C9298', fontSize: 11 }} />
              <Tooltip contentStyle={{ border: '1px solid #E2DDD4', borderRadius: 12, boxShadow: '0 8px 24px rgba(23,32,43,.08)', fontSize: 12 }} />
              <Area type="monotone" dataKey="issued" name="Issued" stroke="#B9563E" strokeWidth={2.5} fill="url(#issuedFill)" />
              <Area type="monotone" dataKey="returned" name="Returned" stroke="#667A62" strokeWidth={2.5} fill="url(#returnedFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center gap-5 text-xs text-slate-500">
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-clay" />Issued</span>
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-moss" />Returned</span>
        </div>
      </div>

      <div className="rounded-2xl border border-ink bg-ink p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="label text-white/50">Circulation status</p>
            <h2 className="mt-3 max-w-[200px] font-display text-2xl font-semibold leading-tight tracking-[-0.04em]">
              Copies in motion.
            </h2>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <Activity className="h-5 w-5 text-[#E5C56B]" />
          </div>
        </div>
        <div className="mt-10 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-white/55">
              <span>Copies in circulation</span>
              <span className="font-semibold text-white">{metrics.borrowedCopies} / {metrics.totalCopies}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#E5C56B] transition-all duration-700" style={{ width: metrics.utilization + '%' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/[.07] p-3">
              <p className="text-2xl font-semibold tracking-[-0.04em]">{metrics.pendingReservations}</p>
              <p className="mt-1 text-[11px] text-white/55">Reservations</p>
            </div>
            <div className="rounded-xl bg-white/[.07] p-3">
              <p className="text-2xl font-semibold tracking-[-0.04em]">
                {role === 'member'
                  ? data.borrows.filter((borrow) => borrow.status === 'returned').length
                  : data.members.filter((member) => member.status === 'Active').length}
              </p>
              <p className="mt-1 text-[11px] text-white/55">{role === 'member' ? 'Books returned' : 'Active members'}</p>
            </div>
          </div>
        </div>
        <Link
          to={role === 'member' ? '/history' : '/circulation'}
          className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-[#E5C56B] hover:underline"
        >
          {role === 'member' ? 'View your history' : 'Open circulation desk'} <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>

    <section className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,32,43,0.03)] sm:p-6">
        <SectionHeading eyebrow="Recent records" title="Latest circulation" />
        {recentBorrows.length ? (
          <div className="divide-y divide-line">
            {recentBorrows.map((borrow) => {
              const copy = data.copies.find((item) => item.id === borrow.copyId)
              return (
                <div key={borrow.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-clay" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      <span className="font-semibold">{role === 'member' ? 'Loan' : getMemberName(borrow.memberId, data.members)}</span> ? {copy ? getBookTitle(copy.bookId, data.books) : 'Copy record'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {borrow.status === 'returned'
                        ? 'Returned ' + formatCompactDate(borrow.returnedAt ?? borrow.issuedAt)
                        : 'Issued ' + formatCompactDate(borrow.issuedAt)}
                    </p>
                  </div>
                  <Badge tone={borrow.status === 'overdue' ? 'red' : borrow.status === 'returned' ? 'blue' : 'green'}>
                    {borrow.status}
                  </Badge>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="rounded-xl bg-fog p-5 text-sm text-slate-500">No circulation records yet.</p>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,32,43,0.03)] sm:p-6">
        <SectionHeading
          eyebrow={role === 'member' ? 'Your loans' : 'Loans'}
          title="Current loans"
          action={<Badge tone="amber">{metrics.overdueLoans} overdue</Badge>}
        />
        {currentLoans.length ? (
          <div className="space-y-4">
            {currentLoans.map((borrow) => {
              const copy = data.copies.find((item) => item.id === borrow.copyId)
              const member = data.members.find((item) => item.id === borrow.memberId)
              return (
                <div key={borrow.id} className="flex items-center gap-3">
                  <Avatar name={member?.name ?? 'Member'} tone={member?.avatarTone} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {role === 'member' ? getBookTitle(copy?.bookId ?? '', data.books) : getMemberName(borrow.memberId, data.members)}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {role === 'member' ? 'Due ' : (copy ? getBookTitle(copy.bookId, data.books) + ' ? due ' : 'Due ')}
                      {formatCompactDate(borrow.dueAt)}
                    </p>
                  </div>
                  <Badge tone={borrow.status === 'overdue' ? 'red' : 'green'}>
                    {borrow.status === 'overdue' ? 'Overdue' : 'On track'}
                  </Badge>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No current loans.</p>
        )}
        <Link
          to={role === 'member' ? '/history' : '/circulation'}
          className="mt-6 flex items-center gap-1 text-xs font-bold text-clay hover:underline"
        >
          See all loans <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  </div>
}
