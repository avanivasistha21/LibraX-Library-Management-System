import { ArrowRight, BookOpen, KeyRound, Mail } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/app/session'
import { Button, Field, Input } from '@/components/ui'

export function LoginPage() {
  const navigate = useNavigate()
  const { user, login } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user, navigate])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replace(/^API request failed with status \d+:\s*/, '') : 'Sign in failed. Check your details and try again.')
    } finally {
      setPending(false)
    }
  }

  return <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.05fr_.95fr]">
    <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full border border-white/10" />
      <div className="absolute -bottom-44 -left-28 h-[520px] w-[520px] rounded-full border border-white/10" />
      <div className="relative flex items-center gap-3"><span className="brand-logo"><img src="/librax-logo.png" alt="LibraX logo" /></span><span className="font-display text-lg font-semibold tracking-[-0.04em]">LibraX</span></div>
      <div className="relative max-w-lg"><h1 className="font-display text-6xl font-semibold leading-[.98] tracking-[-0.07em]">A quieter way to keep knowledge moving.</h1><p className="mt-7 max-w-md text-sm leading-7 text-white/60">Titles, copies, people, and every careful handoff between them.</p></div>
      <div className="relative text-xs text-white/45">LibraX library operations</div>
    </div>
    <main className="flex min-h-screen items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-10 flex items-center gap-3 lg:hidden"><span className="brand-logo"><img src="/librax-logo.png" alt="LibraX logo" /></span><span className="font-display text-lg font-semibold">LibraX</span></div>
        <div className="mb-8"><p className="label text-clay">Secure library access</p><h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.06em] text-ink">Welcome back.</h2><p className="mt-4 text-sm leading-6 text-slate-500">Sign in with your account credentials to open your workspace.</p></div>
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <Field label="Email address"><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-10" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@librax.edu" /></div></Field>
          <Field label="Password"><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-10" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></div></Field>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="h-12 w-full" size="md" disabled={pending || !email || !password}>{pending ? 'Signing in…' : 'Sign in'} <ArrowRight className="h-4 w-4" /></Button>
        </form>
        <div className="mt-8 flex items-start gap-3 rounded-xl bg-fog p-4 text-xs leading-5 text-slate-500"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-clay" /><p>Your account determines your role and access. Members can only view and manage their own loans, holds, and fines.</p></div>
      </div>
    </main>
  </div>
}
