import { KeyRound, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { changePassword } from '@/services/api'
import { Button, Field, Input, SectionHeading } from '@/components/ui'

export function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setError('')
    if (newPassword !== confirmPassword) { setError('The new passwords do not match.'); return }
    setPending(true)
    try {
      await changePassword(currentPassword, newPassword)
      setMessage('Your password has been updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replace(/^API request failed with status \d+:\s*/, '') : 'Password update failed.')
    } finally { setPending(false) }
  }
  return <div className="max-w-3xl space-y-6 fade-up">
    <div><p className="label text-clay">Account security</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">Your account, securely yours.</h2><p className="mt-2 text-sm text-slate-500">Change the password used to sign in to this account.</p></div>
    <form onSubmit={(event) => void submit(event)} className="rounded-2xl border border-line bg-white p-6 shadow-[0_8px_24px_rgba(23,32,43,0.03)] sm:p-8">
      <SectionHeading eyebrow="Password" title="Update sign-in credentials" />
      <div className="max-w-xl space-y-5">
        <Field label="Current password"><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-10" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div></Field>
        <Field label="New password" hint="Use at least 8 characters."><Input type="password" minLength={8} autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field>
        <Field label="Confirm new password"><Input type="password" minLength={8} autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></Field>
      </div>
      {message && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-moss"><ShieldCheck className="h-4 w-4" />{message}</p>}
      {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
      <div className="mt-7 flex justify-end border-t border-line pt-5"><Button type="submit" disabled={pending || newPassword.length < 8 || !currentPassword}>{pending ? 'Updating…' : 'Update password'}</Button></div>
    </form>
  </div>
}
