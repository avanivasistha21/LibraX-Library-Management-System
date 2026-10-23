import { Building2, Tags, UserRoundPen } from 'lucide-react'
import { useState } from 'react'
import { Badge, EmptyState, SearchInput, SectionHeading } from '@/components/ui'
import { useLibrary } from '@/hooks/useLibrary'

export function MetadataPage() {
  const { data } = useLibrary()
  const [tab, setTab] = useState<'authors' | 'publishers' | 'categories'>('authors')
  const [search, setSearch] = useState('')
  if (!data) return <EmptyState title="Metadata is loading" description="The catalogue will be available in a moment." />
  const tabs = [
    { value: 'authors' as const, label: 'Authors', icon: UserRoundPen, count: data.authors.length },
    { value: 'publishers' as const, label: 'Publishers', icon: Building2, count: data.publishers.length },
    { value: 'categories' as const, label: 'Categories', icon: Tags, count: data.categories.length },
  ]
  const title = tab[0].toUpperCase() + tab.slice(1)
  return <div className="space-y-6 fade-up"><div><p className="label text-clay">Reference tables</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">Catalogue reference data.</h2><p className="mt-2 text-sm text-slate-500">These records are maintained with the catalogue database.</p></div>
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="space-y-2">{tabs.map((item) => { const Icon = item.icon; return <button key={item.value} onClick={() => setTab(item.value)} className={tab === item.value ? 'flex w-full items-center gap-3 rounded-xl bg-white px-3 py-3 text-left text-sm font-semibold text-ink shadow-[0_5px_16px_rgba(23,32,43,.06)]' : 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-500 hover:bg-white/60'}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F8E8E3] text-clay"><Icon className="h-4 w-4" /></span>{item.label}<span className="ml-auto text-xs text-slate-400">{item.count}</span></button> })}</div>
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_24px_rgba(23,32,43,0.03)]">
        <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-end sm:justify-between"><SectionHeading eyebrow="Database reference" title={title} /><SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={'Search ' + title.toLowerCase() + '…'} className="sm:w-56" /></div>
        <div className="divide-y divide-line">
          {tab === 'authors' && data.authors.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())).map((item) => <div key={item.id} className="flex items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-fog text-xs font-bold text-slate-500">{item.initials}</span><div><p className="text-sm font-semibold text-ink">{item.name}</p><p className="mt-1 text-xs text-slate-400">{data.books.filter((book) => book.authorIds.includes(item.id)).length} titles</p></div></div><Badge>Active</Badge></div>)}
          {tab === 'publishers' && data.publishers.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())).map((item) => <div key={item.id} className="flex items-center justify-between px-5 py-4"><div><p className="text-sm font-semibold text-ink">{item.name}</p><p className="mt-1 text-xs text-slate-400">{item.city} · {data.books.filter((book) => book.publisherId === item.id).length} titles</p></div><Badge>Active</Badge></div>)}
          {tab === 'categories' && data.categories.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())).map((item) => <div key={item.id} className="flex items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.accent }} /><div><p className="text-sm font-semibold text-ink">{item.name}</p><p className="mt-1 text-xs text-slate-400">/{item.slug} · {data.books.filter((book) => book.categoryId === item.id).length} titles</p></div></div><Badge>Active</Badge></div>)}
        </div>
      </div>
    </div>
  </div>
}
