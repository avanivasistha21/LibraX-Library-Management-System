import { CircleDollarSign, CreditCard, ReceiptIndianRupee } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '@/app/session'
import { Avatar, Badge, Button, ErrorState, LoadingState, SectionHeading, Select } from '@/components/ui'
import { useFineMutation, useLibrary } from '@/hooks/useLibrary'
import { formatCurrency, formatDate, getMemberName } from '@/lib/utils'
import type { PaymentStatus } from '@/types'

export function FinesPage() {
  const { role } = useSession()
  const { data, isLoading, isError, refetch } = useLibrary()
  const mutation = useFineMutation()
  const [filter, setFilter] = useState('all')
  const [payingId, setPayingId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')

  if (isLoading) return <LoadingState label="Calculating outstanding fines?" />
  if (isError || !data) return <ErrorState retry={() => void refetch()} />

  const rows = data.fines.filter((fine) => filter === 'all' || fine.status === filter)
  const outstanding = data.fines.filter((fine) => fine.status === 'unpaid').reduce((sum, fine) => sum + fine.amount, 0)
  const collected = data.fines.filter((fine) => fine.status === 'paid').reduce((sum, fine) => sum + fine.amount, 0)
  const isMember = role === 'member'

  const updateStatus = (id: string, status: PaymentStatus) =>
    void mutation.mutateAsync({ id, status }).catch(() => undefined)

  const handlePayFine = async (fineId: string) => {
    setPayingId(fineId)
    setSuccessMessage('')
    try {
      await mutation.mutateAsync({ id: fineId, status: 'paid' })
      setSuccessMessage('Payment successful! Your fine has been marked as paid and recorded in the library records.')
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch {
      // Handled by mutation.isError
    } finally {
      setPayingId(null)
    }
  }

  const handlePayAll = async () => {
    const unpaid = data.fines.filter((fine) => fine.status === 'unpaid')
    if (unpaid.length === 0) return
    setPayingId('all')
    setSuccessMessage('')
    try {
      for (const fine of unpaid) {
        await mutation.mutateAsync({ id: fine.id, status: 'paid' })
      }
      setSuccessMessage(`All ${unpaid.length} fine(s) have been successfully paid!`)
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch {
      // Handled by mutation.isError
    } finally {
      setPayingId(null)
    }
  }

  return (
    <div className="space-y-6 fade-up">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="label text-clay">{isMember ? 'My account / Fines' : 'Rules / Fines & payments'}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">
            {isMember ? 'Your fines and payments' : 'Overdue, made legible.'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Fines use the backend rate of ?10 per overdue day and update with the loan return transaction.
          </p>
        </div>
        {isMember && outstanding > 0 && (
          <Button onClick={() => void handlePayAll()} disabled={Boolean(payingId)} className="h-10">
            <CreditCard className="h-4 w-4" />
            {payingId === 'all' ? 'Processing payment?' : `Pay total balance (${formatCurrency(outstanding)})`}
          </Button>
        )}
      </div>

      {successMessage && (
        <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5">
          <CircleDollarSign className="h-5 w-5 text-clay" />
          <p className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-ink">{formatCurrency(outstanding)}</p>
          <p className="mt-1 text-xs text-slate-500">Outstanding balance</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <ReceiptIndianRupee className="h-5 w-5 text-[#967421]" />
          <p className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-ink">
            {data.fines.filter((fine) => fine.status === 'unpaid').length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Awaiting payment</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <CreditCard className="h-5 w-5 text-moss" />
          <p className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-ink">{formatCurrency(collected)}</p>
          <p className="mt-1 text-xs text-slate-500">{isMember ? 'Your paid fines' : 'Collected fines'}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_24px_rgba(23,32,43,0.03)]">
        <div className="flex items-center justify-between gap-4 border-b border-line p-5">
          <SectionHeading eyebrow="Fine ledger" title={rows.length + ' records'} />
          <Select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-9 text-xs">
            <option value="all">All payment states</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="waived">Waived</option>
          </Select>
        </div>

        {mutation.isError && (
          <p role="alert" className="border-b border-line bg-red-50 px-5 py-3 text-sm text-red-700">
            {mutation.error instanceof Error ? mutation.error.message : 'Could not update the fine status. Refresh and try again.'}
          </p>
        )}

        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="border-b border-line bg-[#FCFBF9]">
              <tr>
                {[
                  ...(isMember ? [] : ['Member']),
                  'Reason',
                  'Days overdue',
                  'Amount',
                  'Assessed',
                  'Payment status',
                  ...(isMember ? ['Action'] : [])
                ].map((heading) => (
                  <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((fine) => {
                const member = data.members.find((item) => item.id === fine.memberId)
                return (
                  <tr key={fine.id} className="data-row">
                    {!isMember && (
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={member?.name ?? 'Member'} tone={member?.avatarTone} size="sm" />
                          <div>
                            <p className="text-sm font-semibold text-ink">{getMemberName(fine.memberId, data.members)}</p>
                            <p className="mt-1 text-xs text-slate-400">{member?.memberCode}</p>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4 text-sm text-slate-500">{fine.reason}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-ink">{fine.daysOverdue} days</td>
                    <td className="px-5 py-4 text-sm font-semibold text-ink">{formatCurrency(fine.amount)}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{formatDate(fine.assessedAt)}</td>
                    <td className="px-5 py-4">
                      {isMember ? (
                        <Badge tone={fine.status === 'unpaid' ? 'amber' : fine.status === 'paid' ? 'green' : 'neutral'}>
                          {fine.status}
                        </Badge>
                      ) : fine.status === 'unpaid' ? (
                        <Select
                          className="h-8 text-xs"
                          value={fine.status}
                          onChange={(event) => updateStatus(fine.id, event.target.value as PaymentStatus)}
                          disabled={mutation.isPending}
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="paid">Mark paid</option>
                          <option value="waived">Waive fine</option>
                        </Select>
                      ) : (
                        <Badge tone={fine.status === 'paid' ? 'green' : 'neutral'}>{fine.status}</Badge>
                      )}
                    </td>
                    {isMember && (
                      <td className="px-5 py-4 text-right">
                        {fine.status === 'unpaid' ? (
                          <Button
                            size="sm"
                            onClick={() => void handlePayFine(fine.id)}
                            disabled={Boolean(payingId)}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            {payingId === fine.id ? 'Paying?' : `Pay fine`}
                          </Button>
                        ) : (
                          <span className="text-xs font-semibold text-moss">Cleared</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isMember ? 6 : 6} className="px-5 py-12 text-center text-sm text-slate-500">
                    No fines match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
