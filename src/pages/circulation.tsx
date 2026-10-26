import { ArrowDownLeft, ArrowUpRight, BookOpen, CalendarDays, Check, ClipboardList, Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Avatar, Badge, Button, Drawer, ErrorState, Field, Input, LoadingState, SectionHeading, Select } from '@/components/ui'
import { useBorrowMutation, useLibrary, useReturnMutation } from '@/hooks/useLibrary'
import { formatCompactDate, formatCurrency, getBookTitle, getMemberName } from '@/lib/utils'
import { useSession } from '@/app/session'

const defaultDueDate = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  date.setDate(date.getDate() + 14)
  return date.toISOString().slice(0, 10)
}

export function CirculationPage() {
  const { data, isLoading, isError, refetch } = useLibrary()
  const issue = useBorrowMutation()
  const returnBorrow = useReturnMutation()
  const { user } = useSession()
  const [searchParams] = useSearchParams()

  const [issueOpen, setIssueOpen] = useState(() => searchParams.get('action') === 'issue')
  const [returnOpen, setReturnOpen] = useState(() => searchParams.get('action') === 'return')
  const [copyId, setCopyId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [dueAt, setDueAt] = useState(defaultDueDate)
  const [selectedBorrowId, setSelectedBorrowId] = useState('')

  if (isLoading) return <LoadingState label="Opening the circulation desk?" />
  if (isError || !data) return <ErrorState retry={() => void refetch()} />

  const active = data.borrows.filter((borrow) => borrow.status !== 'returned')
  const availableCopies = data.copies.filter((copy) => copy.status === 'available')

  const submitIssue = async () => {
    if (!copyId || !memberId) return
    await issue.mutateAsync({ copyId, memberId, issuedBy: user?.entityId ?? '', dueAt })
    setIssueOpen(false)
    setCopyId('')
    setMemberId('')
  }

  const submitReturn = async () => {
    if (!selectedBorrowId) return
    await returnBorrow.mutateAsync({ id: selectedBorrowId, receivedBy: user?.entityId ?? '' })
    setReturnOpen(false)
    setSelectedBorrowId('')
  }

  const selectedBorrow = data.borrows.find((b) => b.id === selectedBorrowId)
  const selectedCopy = selectedBorrow ? data.copies.find((c) => c.id === selectedBorrow.copyId) : null
  const selectedMember = selectedBorrow ? data.members.find((m) => m.id === selectedBorrow.memberId) : null
  const isOverdue = selectedBorrow
    ? new Date(selectedBorrow.dueAt).getTime() < new Date().setHours(0, 0, 0, 0)
    : false
  const overdueDays = (selectedBorrow && isOverdue)
    ? Math.max(0, Math.ceil((Date.now() - new Date(selectedBorrow.dueAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 0
  const finePreview = overdueDays * 10

  return (
    <div className="space-y-6 fade-up">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="label text-clay">Circulation desk</p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">One view for every handoff.</h2>
          <p className="mt-2 text-sm text-slate-500">
            Issue a physical copy, collect book returns, and let the business rules manage availability and fines.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setIssueOpen(true)}>
            <Plus className="h-4 w-4" /> Issue book
          </Button>
          <Button variant="outline" onClick={() => setReturnOpen(true)}>
            <RotateCcw className="h-4 w-4" /> Collect book
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F8E8E3] text-clay">
              <ArrowUpRight className="h-4 w-4" />
            </span>
            <Badge tone="red">{active.filter((borrow) => borrow.status === 'overdue').length} overdue</Badge>
          </div>
          <p className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-ink">{active.length}</p>
          <p className="mt-1 text-xs text-slate-500">Open loans</p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8F0E6] text-moss">
            <ArrowDownLeft className="h-4 w-4" />
          </span>
          <p className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-ink">
            {data.borrows.filter((borrow) => {
              if (!borrow.returnedAt) return false
              const returned = new Date(borrow.returnedAt)
              const now = new Date()
              return returned.getMonth() === now.getMonth() && returned.getFullYear() === now.getFullYear()
            }).length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Returns this month</p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FBF3D9] text-[#967421]">
            <ClipboardList className="h-4 w-4" />
          </span>
          <p className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-ink">{availableCopies.length}</p>
          <p className="mt-1 text-xs text-slate-500">Copies ready to issue</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_24px_rgba(23,32,43,0.03)]">
        <div className="border-b border-line p-5">
          <SectionHeading eyebrow="Open loan ledger" title="Active loans" action={<Badge tone="neutral">Due date recorded per loan</Badge>} />
        </div>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-line bg-[#FCFBF9]">
              <tr>
                {['Borrower', 'Title / copy', 'Issued', 'Due', 'State', ''].map((heading) => (
                  <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {active.map((borrow) => {
                const copy = data.copies.find((item) => item.id === borrow.copyId)
                const member = data.members.find((item) => item.id === borrow.memberId)
                return (
                  <tr key={borrow.id} className="data-row">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={member?.name ?? 'Member'} tone={member?.avatarTone} size="sm" />
                        <div>
                          <p className="text-sm font-semibold text-ink">{getMemberName(borrow.memberId, data.members)}</p>
                          <p className="mt-1 text-xs text-slate-400">{member?.memberCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-ink">{copy ? getBookTitle(copy.bookId, data.books) : 'Unknown title'}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <BookOpen className="h-3 w-3" />
                        {copy?.accessionNumber}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{formatCompactDate(borrow.issuedAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        {formatCompactDate(borrow.dueAt)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={borrow.status === 'overdue' ? 'red' : 'green'}>
                        {borrow.status === 'overdue' ? 'Overdue' : 'On track'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBorrowId(borrow.id)
                          setReturnOpen(true)
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Collect book
                      </Button>
                    </td>
                  </tr>
                )
              })}
              {active.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    No active loans to collect.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="Issue a book"
        description="Select an available copy and a patron to issue a loan."
      >
        <div className="space-y-5">
          <Field label="Available copy">
            <Select className="w-full" value={copyId} onChange={(event) => setCopyId(event.target.value)}>
              <option value="">Choose a copy?</option>
              {availableCopies.map((copy) => (
                <option key={copy.id} value={copy.id}>
                  {copy.accessionNumber} ? {getBookTitle(copy.bookId, data.books)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Member">
            <Select className="w-full" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
              <option value="">Choose a member?</option>
              {data.members
                .filter((member) => member.status === 'Active')
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.memberCode} ? {member.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Due date" hint="Default policy: 14 days; adjust when necessary.">
            <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </Field>
          <div className="rounded-xl bg-fog p-4 text-xs leading-5 text-slate-500">
            <p className="font-semibold text-ink">Before you confirm</p>
            <p className="mt-1">
              LibraX will mark this copy as <span className="font-semibold text-clay">borrowed</span>, create a borrow record, and make it unavailable to other patrons.
            </p>
          </div>
          {issue.isError && (
            <p role="alert" className="text-sm text-red-700">
              {issue.error instanceof Error ? issue.error.message : 'Failed to issue book.'}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-5">
            <Button variant="outline" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitIssue()} disabled={!copyId || !memberId || issue.isPending}>
              {issue.isPending ? 'Issuing?' : 'Confirm issue'}
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Drawer>

      <Drawer
        open={returnOpen}
        onClose={() => { setReturnOpen(false); setSelectedBorrowId('') }}
        title="Collect book / Receive return"
        description="Check in a physical book returned by a member to make it available again."
      >
        <div className="space-y-5">
          <Field label="Select loan to collect">
            <Select
              className="w-full"
              value={selectedBorrowId}
              onChange={(event) => setSelectedBorrowId(event.target.value)}
            >
              <option value="">Choose an active loan?</option>
              {active.map((b) => {
                const c = data.copies.find((copy) => copy.id === b.copyId)
                const m = data.members.find((mem) => mem.id === b.memberId)
                const overdueTag = b.status === 'overdue' ? ' [OVERDUE]' : ''
                return (
                  <option key={b.id} value={b.id}>
                    {m?.name ?? 'Member'} ({m?.memberCode}) ? {c ? getBookTitle(c.bookId, data.books) : 'Book'} [{c?.accessionNumber}]{overdueTag}
                  </option>
                )
              })}
            </Select>
          </Field>

          {selectedBorrow && selectedCopy && selectedMember && (
            <div className="rounded-xl border border-line bg-[#FCFBF9] p-4 text-xs space-y-2">
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-slate-500">Patron</span>
                <span className="font-semibold text-ink">{selectedMember.name} ({selectedMember.memberCode})</span>
              </div>
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-slate-500">Book & Accession</span>
                <span className="font-semibold text-ink">{getBookTitle(selectedCopy.bookId, data.books)} ? #{selectedCopy.accessionNumber}</span>
              </div>
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-slate-500">Due Date</span>
                <span className="font-semibold text-ink">{formatCompactDate(selectedBorrow.dueAt)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">Status</span>
                <span className={isOverdue ? 'font-bold text-red-600' : 'font-semibold text-moss'}>
                  {isOverdue ? `Overdue by ${overdueDays} day(s)` : 'On schedule'}
                </span>
              </div>
              {isOverdue && finePreview > 0 && (
                <div className="rounded-lg bg-red-50 p-2.5 text-red-700 mt-2">
                  <p className="font-semibold">Automatic Fine Assessment</p>
                  <p className="mt-0.5">An overdue fine of {formatCurrency(finePreview)} (?10/day) will be added to the member account.</p>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl bg-fog p-4 text-xs leading-5 text-slate-500">
            <p className="font-semibold text-ink">Return actions</p>
            <p className="mt-1">
              Confirming return marks the loan as returned, changes copy status back to <span className="font-semibold text-moss">available</span>, and records staff attribution.
            </p>
          </div>

          {returnBorrow.isError && (
            <p role="alert" className="text-sm text-red-700">
              {returnBorrow.error instanceof Error ? returnBorrow.error.message : 'Failed to process return.'}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-5">
            <Button variant="outline" onClick={() => { setReturnOpen(false); setSelectedBorrowId('') }}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitReturn()}
              disabled={!selectedBorrowId || returnBorrow.isPending}
            >
              {returnBorrow.isPending ? 'Processing return?' : 'Confirm return'}
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
