import { BarChart3, BookOpen, ChartNoAxesCombined, PieChart as PieIcon } from 'lucide-react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Badge, SectionHeading, StatCard, ErrorState, LoadingState } from '@/components/ui'
import { useLibrary } from '@/hooks/useLibrary'
import { dashboardMetrics, formatCurrency } from '@/lib/utils'

export function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useLibrary()
  if (isLoading) return <LoadingState label="Preparing the insight layer…" />
  if (isError || !data) return <ErrorState retry={() => void refetch()} />
  const metrics = dashboardMetrics(data)
  const categories = data.categories.map((category) => ({ name: category.name, value: data.books.filter((book) => book.categoryId === category.id).length, color: category.accent })).filter((item) => item.value > 0)
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const now = new Date()
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    const inMonth = (value?: string) => {
      if (!value) return false
      const date = new Date(value)
      return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
    }
    return { month: month.toLocaleDateString('en-IN', { month: 'short' }), issues: data.borrows.filter((borrow) => inMonth(borrow.issuedAt)).length, returns: data.borrows.filter((borrow) => inMonth(borrow.returnedAt)).length }
  })
  return <div className="space-y-6 fade-up">
    <div><p className="label text-clay">Insights / Circulation</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">Library activity from live records.</h2><p className="mt-2 text-sm text-slate-500">Collection, circulation, and fine totals update from the backend snapshot.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Collection use" value={metrics.utilization + '%'} detail="copies currently borrowed" icon={<BookOpen className="h-5 w-5" />} tone="moss" /><StatCard label="Titles" value={metrics.totalTitles} detail="distinct book records" icon={<BookOpen className="h-5 w-5" />} tone="clay" /><StatCard label="Open holds" value={metrics.pendingReservations} detail="ready or queued" icon={<ChartNoAxesCombined className="h-5 w-5" />} tone="butter" /><StatCard label="Fine exposure" value={formatCurrency(metrics.finesDue)} detail="unpaid balances" icon={<BarChart3 className="h-5 w-5" />} tone="ink" /></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6"><SectionHeading eyebrow="Recorded transactions" title="Circulation by month" /><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}><CartesianGrid vertical={false} stroke="#EEEAE3" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8C9298', fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#8C9298', fontSize: 11 }} /><Tooltip cursor={{ fill: '#FAF8F5' }} contentStyle={{ border: '1px solid #E2DDD4', borderRadius: 12, fontSize: 12 }} /><Bar dataKey="issues" name="Issues" fill="#B9563E" radius={[5, 5, 0, 0]} barSize={15} /><Bar dataKey="returns" name="Returns" fill="#9BB096" radius={[5, 5, 0, 0]} barSize={15} /></BarChart></ResponsiveContainer></div><div className="mt-3 flex gap-5 text-xs text-slate-500"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-clay" />Issues</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#9BB096]" />Returns</span></div></div>
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6"><SectionHeading eyebrow="Catalogue" title="Titles by category" /><div className="h-[200px]">{categories.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={4} stroke="none">{categories.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={{ border: '1px solid #E2DDD4', borderRadius: 12, fontSize: 12 }} /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">No category records.</div>}</div><div className="space-y-3">{categories.map((item) => <div key={item.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-500"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-semibold text-ink">{item.value}</span></div>)}</div><div className="mt-5 flex items-center gap-2 rounded-xl bg-fog px-3 py-2.5 text-xs text-slate-500"><PieIcon className="h-3.5 w-3.5 text-clay" />Based on current catalogue records.</div></div>
    </div>
  </div>
}
