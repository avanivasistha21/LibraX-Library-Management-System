import { ArrowRight, BookOpen, KeyRound, Mail, Phone, User, UserPlus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/app/session'
import { Button, Field, Input, Select } from '@/components/ui'

export function LoginPage() {
  const navigate = useNavigate()
  const { user, login, register } = useSession()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [memberType, setMemberType] = useState<'Student' | 'Faculty' | 'Staff'>('Student')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user, navigate])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      if (mode === 'login') {
        await login(email.trim(), password)
      } else {
        if (!name.trim()) {
          setError('Please provide your full name.')
          setPending(false)
          return
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters long.')
          setPending(false)
          return
        }
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          memberType,
          phone: phone.trim()
        })
      }
      navigate('/', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replace(/^API request failed with status \d+:\s*/, '') : 'Operation failed. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.05fr_.95fr]">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full border border-white/10" />
        <div className="absolute -bottom-44 -left-28 h-[520px] w-[520px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="brand-logo"><img src="/librax-logo.png" alt="LibraX logo" /></span>
          <span className="font-display text-lg font-semibold tracking-[-0.04em]">LibraX</span>
        </div>
        <div className="relative max-w-lg">
          <h1 className="font-display text-6xl font-semibold leading-[.98] tracking-[-0.07em]">
            A quieter way to keep knowledge moving.
          </h1>
          <p className="mt-7 max-w-md text-sm leading-7 text-white/60">
            Titles, copies, people, and every careful handoff between them.
          </p>
        </div>
        <div className="relative text-xs text-white/45">LibraX library operations</div>
      </div>

      <main className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="brand-logo"><img src="/librax-logo.png" alt="LibraX logo" /></span>
            <span className="font-display text-lg font-semibold">LibraX</span>
          </div>

          <div className="mb-6 flex rounded-xl border border-line bg-fog p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 rounded-lg py-2 transition ${mode === 'login' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError('') }}
              className={`flex-1 rounded-lg py-2 transition ${mode === 'register' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink'}`}
            >
              Create account
            </button>
          </div>

          <div className="mb-6">
            <p className="label text-clay">{mode === 'login' ? 'Secure library access' : 'New patron registration'}</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.06em] text-ink">
              {mode === 'login' ? 'Welcome back.' : 'Create an account.'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {mode === 'login'
                ? 'Sign in with your account credentials to open your workspace.'
                : 'Enter your details and password to register as a library member.'}
            </p>
          </div>

          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            {mode === 'register' && (
              <>
                <Field label="Full name">
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="pl-10"
                      type="text"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Aditi Sharma"
                    />
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Member type">
                    <Select
                      className="w-full"
                      value={memberType}
                      onChange={(event) => setMemberType(event.target.value as typeof memberType)}
                    >
                      <option value="Student">Student</option>
                      <option value="Faculty">Faculty</option>
                      <option value="Staff">Staff</option>
                    </Select>
                  </Field>
                  <Field label="Phone number">
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="pl-10"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+91 ?"
                      />
                    </div>
                  </Field>
                </div>
              </>
            )}

            <Field label="Email address">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-10"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@librax.edu"
                />
              </div>
            </Field>

            <Field label="Password" hint={mode === 'register' ? 'At least 8 characters' : undefined}>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-10"
                  type="password"
                  minLength={mode === 'register' ? 8 : undefined}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'register' ? 'Create a secure password' : 'Enter your password'}
                />
              </div>
            </Field>

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-12 w-full"
              size="md"
              disabled={pending || !email || !password || (mode === 'register' && (!name || password.length < 8))}
            >
              {pending
                ? (mode === 'login' ? 'Signing in?' : 'Creating account?')
                : (mode === 'login' ? 'Sign in' : 'Create account & sign in')}
              {mode === 'login' ? <ArrowRight className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </form>

          {mode === 'login' ? (
            <div className="mt-6 border-t border-line pt-5">
              <p className="mb-2 text-xs font-medium text-slate-500">Quick sign in with demo accounts:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Member', email: 'avani@librax.edu', password: 'change-this-member-password' },
                  { label: 'Librarian', email: 'arjun@librax.edu', password: 'change-this-librarian-password' },
                  { label: 'Admin', email: 'maya@librax.edu', password: 'change-this-admin-password' },
                ].map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email)
                      setPassword(acc.password)
                      setError('')
                    }}
                    className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-clay hover:text-clay"
                  >
                    {acc.label} ({acc.email.split('@')[0]})
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 border-t border-line pt-4 text-center">
              <p className="text-xs text-slate-500">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError('') }}
                  className="font-semibold text-clay hover:underline"
                >
                  Sign in instead
                </button>
              </p>
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 rounded-xl bg-fog p-4 text-xs leading-5 text-slate-500">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-clay" />
            <p>
              Your account determines your role and access. Members can view catalogue titles, reserve books, and track or pay their fines.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
