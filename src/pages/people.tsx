import { KeyRound, Mail, Plus, UserPlus, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Avatar, Badge, Button, Drawer, ErrorState, Field, Input, LoadingState, SearchInput, Select } from '@/components/ui'
import { useLibrary, useMemberMutation, useProvisionMemberAccountMutation } from '@/hooks/useLibrary'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Member } from '@/types'

const emptyDraft = { name: '', email: '', phone: '', password: '', memberType: 'Student' as 'Student' | 'Faculty' | 'Staff' }

export function PeoplePage() {
  const { data, isLoading, isError, refetch } = useLibrary()
  const addMember = useMemberMutation()
  const provisionAccount = useProvisionMemberAccountMutation()
  const [tab, setTab] = useState<'members' | 'librarians'>('members')
  const [search, setSearch] = useState('')
  const [searchParams] = useSearchParams()
  const [open, setOpen] = useState(() => searchParams.get('action') === 'add')
  const [draft, setDraft] = useState(emptyDraft)
  const [accountMember, setAccountMember] = useState<Member | null>(null)
  const [accountPassword, setAccountPassword] = useState('')
  if (isLoading) return <LoadingState label="Opening the people directory…" />
  if (isError || !data) return <ErrorState retry={() => void refetch()} />
  const members = data.members.filter((person) => [person.name, person.email, person.memberCode].join(' ').toLowerCase().includes(search.toLowerCase()))
  const librarians = data.librarians.filter((person) => [person.name, person.email, person.employeeCode].join(' ').toLowerCase().includes(search.toLowerCase()))
  const peopleCount = tab === 'members' ? members.length : librarians.length
  const saveMember = async () => {
    if (!draft.name || !draft.email || draft.password.length < 8) return
    await addMember.mutateAsync({ ...draft, memberCode: 'MBR-' + Date.now().toString().slice(-6), joinedAt: new Date().toISOString(), activeLoans: 0, outstandingFine: 0, avatarTone: '#7E9E9A', status: 'Active' })
    setOpen(false)
    setDraft(emptyDraft)
  }
  return <div className="space-y-6 fade-up">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="label text-clay">People & access</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">Members & staff</h2></div><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add member</Button></div>
    <div className="flex items-center gap-1 border-b border-line">
      <button onClick={() => setTab('members')} className={tab === 'members' ? 'border-b-2 border-clay px-3 py-3 text-sm font-semibold text-ink' : 'border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-400'}><UsersRound className="mr-2 inline h-4 w-4" />Members <span className="ml-1 text-xs text-slate-400">{data.members.length}</span></button>
      <button onClick={() => setTab('librarians')} className={tab === 'librarians' ? 'border-b-2 border-clay px-3 py-3 text-sm font-semibold text-ink' : 'border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-400'}><UserPlus className="mr-2 inline h-4 w-4" />Librarians <span className="ml-1 text-xs text-slate-400">{data.librarians.length}</span></button>
    </div>
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_24px_rgba(23,32,43,0.03)]">
      <div className="flex items-center justify-between gap-4 border-b border-line p-4"><SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={'Search ' + tab + '…'} className="max-w-sm" /><Badge tone="green">{peopleCount} records</Badge></div>
      <div className="scrollbar-thin overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead className="border-b border-line bg-[#FCFBF9]"><tr>{(tab === 'members' ? ['Member', 'Type', 'Loans', 'Outstanding', 'Joined', 'Status', 'Account'] : ['Staff member', 'Role', 'Shift', 'Email', 'Status']).map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{heading}</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{tab === 'members' ? members.map((member) => <tr key={member.id} className="data-row"><td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar name={member.name} tone={member.avatarTone} size="sm" /><div><p className="text-sm font-semibold text-ink">{member.name}</p><p className="mt-1 text-xs text-slate-400">{member.memberCode} · {member.email}</p></div></div></td><td className="px-5 py-4"><Badge>{member.memberType}</Badge></td><td className="px-5 py-4 text-sm font-semibold">{member.activeLoans}</td><td className="px-5 py-4 text-sm font-semibold">{member.outstandingFine ? formatCurrency(member.outstandingFine) : <span className="text-moss">Clear</span>}</td><td className="px-5 py-4 text-sm text-slate-500">{formatDate(member.joinedAt)}</td><td className="px-5 py-4"><Badge tone={member.status === 'Active' ? 'green' : 'red'}>{member.status}</Badge></td><td className="px-5 py-4"><Button variant="outline" size="sm" onClick={() => { setAccountMember(member); setAccountPassword('') }}>Set / reset login</Button></td></tr>) : librarians.map((person) => <tr key={person.id} className="data-row"><td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar name={person.name} tone={person.avatarTone} size="sm" /><span className="text-sm font-semibold">{person.name}</span></div></td><td className="px-5 py-4 text-sm">{person.role}</td><td className="px-5 py-4 text-sm text-slate-500">{person.shift}</td><td className="px-5 py-4 text-sm text-slate-500"><Mail className="mr-1 inline h-3 w-3" />{person.email}</td><td className="px-5 py-4"><Badge tone={person.status === 'Active' ? 'green' : 'neutral'}>{person.status}</Badge></td></tr>)}</tbody></table></div>
    </div>
    <Drawer open={open} onClose={() => setOpen(false)} title="Add a member" description="Create the member record and its login in one transaction."><div className="space-y-5">
      <Field label="Full name"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Aditi Sharma" /></Field>
      <Field label="Email"><Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="name@librax.edu" /></Field>
      <Field label="Initial password" hint="At least 8 characters. Members can change it in account settings."><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-10" type="password" minLength={8} autoComplete="new-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} /></div></Field>
      <Field label="Phone"><Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="+91 …" /></Field>
      <Field label="Member type"><Select className="w-full" value={draft.memberType} onChange={(event) => setDraft({ ...draft, memberType: event.target.value as typeof draft.memberType })}><option>Student</option><option>Faculty</option><option>Staff</option></Select></Field>
      {addMember.isError && <p role="alert" className="text-sm text-red-700">{addMember.error instanceof Error ? addMember.error.message : 'Could not create member. Check whether this email is already in use.'}</p>}
      <div className="flex justify-end gap-2 border-t border-line pt-5"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void saveMember()} disabled={addMember.isPending || !draft.name || !draft.email || draft.password.length < 8}>{addMember.isPending ? 'Adding…' : 'Add member'}</Button></div>
    </div></Drawer>
    <Drawer open={Boolean(accountMember)} onClose={() => setAccountMember(null)} title="Set member login" description={accountMember ? `Assign a password for ${accountMember.name}. Resetting it signs out their existing sessions.` : undefined}><div className="space-y-5">
      <Field label="New password" hint="At least 8 characters. Share it with the member through a secure channel."><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-10" type="password" minLength={8} autoComplete="new-password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} /></div></Field>
      {provisionAccount.isError && <p role="alert" className="text-sm text-red-700">Could not update this member login. Please try again.</p>}
      <div className="flex justify-end gap-2 border-t border-line pt-5"><Button variant="outline" onClick={() => setAccountMember(null)}>Cancel</Button><Button disabled={!accountMember || accountPassword.length < 8 || provisionAccount.isPending} onClick={() => { if (!accountMember) return; void provisionAccount.mutateAsync({ memberId: accountMember.id, password: accountPassword }).then(() => { setAccountMember(null); setAccountPassword('') }).catch(() => {}) }}>{provisionAccount.isPending ? 'Saving…' : 'Save login'}</Button></div>
    </div></Drawer>
  </div>
}
