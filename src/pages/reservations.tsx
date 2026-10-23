import { ArrowUpRight, CalendarClock, Check, Clock3, ListFilter, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '@/app/session'
import { Avatar, Badge, Button, Drawer, ErrorState, Field, LoadingState, SectionHeading, Select } from '@/components/ui'
import { useCreateReservationMutation, useLibrary, useReservationMutation } from '@/hooks/useLibrary'
import { formatCompactDate, getBookTitle, getMemberName } from '@/lib/utils'
import type { ReservationStatus } from '@/types'

export function ReservationsPage() {
  const { user, role } = useSession()
  const { data, isLoading, isError, refetch } = useLibrary()
  const mutation = useReservationMutation()
  const createReservation = useCreateReservationMutation()
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [bookId, setBookId] = useState('')
  const [memberId, setMemberId] = useState('')
  if (isLoading) return <LoadingState label="Sorting the reservation queue…" />
  if (isError || !data) return <ErrorState retry={() => void refetch()} />
  const isMember = role === 'member'
  const rows = data.reservations.filter((reservation) => filter === 'all' || reservation.status === filter)
  const statusTone = (status: string) => status === 'ready' ? 'green' : status === 'queued' ? 'amber' : status === 'fulfilled' ? 'blue' : 'neutral'
  const submitReservation = async () => {
    const ownerId = isMember ? user?.entityId : memberId
    if (!bookId || !ownerId) return
    await createReservation.mutateAsync({ bookId, memberId: ownerId })
    setOpen(false)
    setBookId('')
    setMemberId('')
  }
  const updateStatus = (id: string, status: ReservationStatus) => void mutation.mutateAsync({ id, status }).catch(() => undefined)
  return <div className="space-y-6 fade-up">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="label text-clay">{isMember ? 'My account / Reservations' : 'Circulation / Reservations'}</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">{isMember ? 'Your reservations' : 'Reservation queue'}</h2><p className="mt-2 text-sm text-slate-500">{isMember ? 'Track your holds and cancel a queued reservation.' : 'Manage the hold queue and pickup status.'}</p></div><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New reservation</Button></div>
    <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-line bg-white p-5"><CalendarClock className="h-5 w-5 text-clay" /><p className="mt-5 text-3xl font-semibold tracking-[-0.05em]">{data.reservations.filter((item) => item.status === 'queued').length}</p><p className="mt-1 text-xs text-slate-500">In queue</p></div><div className="rounded-2xl border border-line bg-white p-5"><Check className="h-5 w-5 text-moss" /><p className="mt-5 text-3xl font-semibold tracking-[-0.05em]">{data.reservations.filter((item) => item.status === 'ready').length}</p><p className="mt-1 text-xs text-slate-500">Ready for pickup</p></div><div className="rounded-2xl border border-line bg-white p-5"><Clock3 className="h-5 w-5 text-[#967421]" /><p className="mt-5 text-3xl font-semibold tracking-[-0.05em]">{data.reservations.filter((item) => item.status === 'fulfilled').length}</p><p className="mt-1 text-xs text-slate-500">Fulfilled</p></div></div>
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_24px_rgba(23,32,43,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5"><SectionHeading eyebrow="Hold queue" title={rows.length + ' reservations'} /><div className="flex items-center gap-2"><ListFilter className="h-4 w-4 text-slate-400" /><Select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-9 text-xs"><option value="all">All status</option><option value="queued">Queued</option><option value="ready">Ready</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option></Select></div></div>
      <div className="divide-y divide-line">{rows.map((reservation) => <div key={reservation.id} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><Avatar name={getMemberName(reservation.memberId, data.members)} tone={data.members.find((member) => member.id === reservation.memberId)?.avatarTone} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{getBookTitle(reservation.bookId, data.books)}</p><p className="mt-1 truncate text-xs text-slate-400">{isMember ? 'Placed ' : getMemberName(reservation.memberId, data.members) + ' · placed '}{formatCompactDate(reservation.placedAt)}</p></div></div><div className="flex flex-wrap items-center gap-3 sm:gap-5"><div className="hidden text-right sm:block"><p className="label">Position</p><p className="mt-1 text-sm font-semibold text-ink">#{reservation.queuePosition}</p></div><div className="hidden text-right sm:block"><p className="label">Expires</p><p className="mt-1 text-sm font-semibold text-ink">{formatCompactDate(reservation.expiresAt)}</p></div><Badge tone={statusTone(reservation.status)}>{reservation.status}</Badge>{isMember ? reservation.status === 'queued' && <Button size="icon" variant="ghost" aria-label="Cancel reservation" onClick={() => updateStatus(reservation.id, 'cancelled')} disabled={mutation.isPending}><X className="h-4 w-4 text-slate-400" /></Button> : <Select className="h-9 text-xs" value={reservation.status} onChange={(event) => updateStatus(reservation.id, event.target.value as ReservationStatus)} disabled={mutation.isPending}><option value="queued">Queued</option><option value="ready">Ready</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option></Select>}</div></div>)}
      {rows.length === 0 && <p className="px-5 py-12 text-center text-sm text-slate-500">No reservations match this filter.</p>}</div>
    </div>
    <Drawer open={open} onClose={() => setOpen(false)} title="New reservation" description={isMember ? 'Place a hold for your account.' : 'Add a member to the next available copy queue.'}>
      <div className="space-y-5"><Field label="Book title"><Select className="w-full" value={bookId} onChange={(event) => setBookId(event.target.value)}><option value="">Choose a title…</option>{data.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</Select></Field>
        {!isMember && <Field label="Member"><Select className="w-full" value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">Choose a member…</option>{data.members.filter((member) => member.status === 'Active').map((member) => <option key={member.id} value={member.id}>{member.memberCode} · {member.name}</option>)}</Select></Field>}
        {createReservation.isError && <p role="alert" className="text-sm text-red-700">Could not place the reservation. Please try again.</p>}
        <div className="rounded-xl bg-fog p-4 text-xs leading-5 text-slate-500"><p className="font-semibold text-ink">Queue rules</p><p className="mt-1">Your position is assigned by the backend when the hold is created.</p></div>
        <div className="flex justify-end gap-2 border-t border-line pt-5"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void submitReservation()} disabled={!bookId || (!isMember && !memberId) || createReservation.isPending}>{createReservation.isPending ? 'Adding…' : 'Place reservation'}<ArrowUpRight className="h-4 w-4" /></Button></div>
      </div>
    </Drawer>
  </div>
}
