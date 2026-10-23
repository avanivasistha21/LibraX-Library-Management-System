import { FileClock } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '@/app/session'
import { Badge, ErrorState, LoadingState, SearchInput, SectionHeading, Select } from '@/components/ui'
import { useLibrary } from '@/hooks/useLibrary'
import { formatDate, getBookTitle, getMemberName } from '@/lib/utils'

export function HistoryPage() {
  const { role } = useSession()
  const { data, isLoading, isError, refetch } = useLibrary()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  if (isLoading) return <LoadingState label="Replaying the borrowing ledger…" />
  if (isError || !data) return <ErrorState retry={() => void refetch()} />
  const isMember = role === 'member'
  const rows = data.borrows.filter((borrow) => {
    const copy = data.copies.find((item) => item.id === borrow.copyId)
    const query = (getBookTitle(copy?.bookId ?? '', data.books) + ' ' + getMemberName(borrow.memberId, data.members)).toLowerCase()
    return query.includes(search.toLowerCase()) && (status === 'all' || borrow.status === status)
  })
  return <div className="space-y-6 fade-up">
    <div><p className="label text-clay">{isMember ? 'My account / History' : 'Archive / Borrowing history'}</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">{isMember ? 'Your borrowing history' : 'Every return leaves a trace.'}</h2><p className="mt-2 text-sm text-slate-500">{isMember ? 'Your loans and returns.' : 'A record of library circulation transactions.'}</p></div>
    <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_8px_24px_rgba(23,32,43,0.03)]"><div className="flex flex-col gap-3 sm:flex-row"><SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isMember ? 'Search your books…' : 'Search member or title…'} className="sm:max-w-md" /><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All transactions</option><option value="active">Active</option><option value="overdue">Overdue</option><option value="returned">Returned</option></Select></div></div>
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_24px_rgba(23,32,43,0.03)]"><div className="border-b border-line p-5"><SectionHeading eyebrow="Transaction log" title={rows.length + ' records'} /></div><div className="scrollbar-thin overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="border-b border-line bg-[#FCFBF9]"><tr>{['Borrow ID', ...(isMember ? [] : ['Member']), 'Book / copy', 'Issued', 'Returned / due', 'State'].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{heading}</th>)}</tr></thead><tbody className="divide-y divide-line">
      {rows.map((borrow) => { const copy = data.copies.find((item) => item.id === borrow.copyId); return <tr key={borrow.id} className="data-row"><td className="px-5 py-4"><span className="inline-flex items-center gap-2 text-xs font-bold text-ink"><FileClock className="h-3.5 w-3.5 text-clay" />{borrow.id}</span></td>{!isMember && <td className="px-5 py-4 text-sm font-semibold text-ink">{getMemberName(borrow.memberId, data.members)}</td>}<td className="px-5 py-4"><p className="text-sm font-semibold text-ink">{getBookTitle(copy?.bookId ?? '', data.books)}</p><p className="mt-1 text-xs text-slate-400">{copy?.accessionNumber}</p></td><td className="px-5 py-4 text-sm text-slate-500">{formatDate(borrow.issuedAt)}</td><td className="px-5 py-4 text-sm text-slate-500">{borrow.returnedAt ? formatDate(borrow.returnedAt) : 'Due ' + formatDate(borrow.dueAt)}</td><td className="px-5 py-4"><Badge tone={borrow.status === 'returned' ? 'blue' : borrow.status === 'overdue' ? 'red' : 'green'}>{borrow.status}</Badge></td></tr>})}
      {rows.length === 0 && <tr><td colSpan={isMember ? 5 : 6} className="px-5 py-12 text-center text-sm text-slate-500">No borrowing records match this filter.</td></tr>}
    </tbody></table></div></div>
  </div>
}
