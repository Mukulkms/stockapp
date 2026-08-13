import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Calendar, SlidersHorizontal } from 'lucide-react'
import { getProfitLossApi, getGroupsApi } from '../api/endpoints'
import { BillingGroup, ProfitLossReport } from '../types'
import Amount from '../components/Amount'
import MonthlySalesPanel from '../components/MonthlySalesPanel'
import { todayISO } from '../lib/helpers'

type StatusFilter = 'all' | 'profit' | 'loss'
type SortKey = 'name' | 'netProfitDesc' | 'netProfitAsc' | 'salesDesc' | 'purchaseDesc'
type BasisKey = 'accurate' | 'simple'

function firstDayOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

const PRESETS = [
  { label: 'This month', from: firstDayOfMonth(), to: todayISO() },
  { label: 'Last 30 days', from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], to: todayISO() },
  { label: 'This year', from: `${new Date().getFullYear()}-01-01`, to: todayISO() },
  { label: 'All time', from: '', to: '' }
]

export default function Reports() {
  const [from, setFrom] = useState(firstDayOfMonth())
  const [to, setTo] = useState(todayISO())
  const [report, setReport] = useState<ProfitLossReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- Company-wise breakdown filters ---
  const [groups, setGroups] = useState<BillingGroup[]>([])
  const [companyFilter, setCompanyFilter] = useState('all')
  const [companySearch, setCompanySearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [basis, setBasis] = useState<BasisKey>('accurate')

  useEffect(() => { getGroupsApi().then(setGroups).catch(() => {}) }, [])

  const load = (f: string, t: string) => {
    setLoading(true)
    setError(null)
    getProfitLossApi(f || undefined, t || undefined)
      .then(setReport)
      .catch((e: any) => setError(e?.response?.data?.message || e?.message || 'Report load nahi hua, backend check karo'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(from, to) }, []) // eslint-disable-line

  const applyPreset = (p: typeof PRESETS[number]) => {
    setFrom(p.from); setTo(p.to); load(p.from, p.to)
  }

  const filteredCompanies = useMemo(() => {
    if (!report) return []
    let rows = report.companies

    if (companyFilter !== 'all') {
      rows = rows.filter(c => (c.groupId || 'unassigned') === companyFilter)
    }
    if (companySearch.trim()) {
      const q = companySearch.trim().toLowerCase()
      rows = rows.filter(c => c.groupName.toLowerCase().includes(q))
    }
    if (status !== 'all') {
      rows = rows.filter(c => {
        const profit = basis === 'accurate' ? c.netProfit : c.simpleNetProfit
        return status === 'profit' ? profit >= 0 : profit < 0
      })
    }

    rows = [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'netProfitDesc': {
          const av = basis === 'accurate' ? a.netProfit : a.simpleNetProfit
          const bv = basis === 'accurate' ? b.netProfit : b.simpleNetProfit
          return bv - av
        }
        case 'netProfitAsc': {
          const av = basis === 'accurate' ? a.netProfit : a.simpleNetProfit
          const bv = basis === 'accurate' ? b.netProfit : b.simpleNetProfit
          return av - bv
        }
        case 'salesDesc': return b.totalSales - a.totalSales
        case 'purchaseDesc': return b.totalPurchase - a.totalPurchase
        default: return a.groupName.localeCompare(b.groupName)
      }
    })

    return rows
  }, [report, companyFilter, companySearch, status, sortKey, basis])

  const filtersActive = companyFilter !== 'all' || companySearch.trim() !== '' || status !== 'all' || sortKey !== 'name'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <h2 className="font-display font-semibold text-2xl mb-1">Profit &amp; Loss</h2>
      <p className="text-sm text-gray-500 mb-6">Company-wise dekho kitni billing hui, kitna kharcha hua, aur kitna profit/loss chal raha hai</p>

      {/* Date range controls */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-gray-400" />
            <div>
              <label className="label mb-1">From</label>
              <input className="input py-1.5" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label mb-1">To</label>
            <input className="input py-1.5" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => load(from, to)}>Apply</button>
          <div className="flex gap-1.5 flex-wrap ml-auto">
            {PRESETS.map(p => (
              <button key={p.label} className="btn btn-sm" onClick={() => applyPreset(p)}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : error ? (
        <div className="card p-4 text-sm" style={{ color: '#DC2626' }}>
          Report load nahi ho paya: {error}
          <button className="btn btn-sm ml-3" onClick={() => load(from, to)}>Retry</button>
        </div>
      ) : !report ? (
        <div className="text-sm text-gray-400">Kuch data nahi mila</div>
      ) : (
        <>
          {/* Overall summary tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="stat-tile" style={{ '--glow': 'rgba(27,37,64,0.18)' } as React.CSSProperties}>
              <div className="text-xs text-gray-500 mb-1">Total Purchase</div>
              <Amount value={report.summary.totalPurchase} size="lg" />
            </div>
            <div className="stat-tile" style={{ '--glow': 'rgba(14,124,107,0.2)' } as React.CSSProperties}>
              <div className="text-xs text-gray-500 mb-1">Total Sales / Billing</div>
              <Amount value={report.summary.totalSales} size="lg" />
            </div>
            <div className="stat-tile" style={{ '--glow': 'rgba(220,38,38,0.18)' } as React.CSSProperties}>
              <div className="text-xs text-gray-500 mb-1">Expenses (incl. general)</div>
              <Amount value={report.summary.expenses + report.summary.generalExpenses} size="lg" />
            </div>
            <div className="stat-tile" style={{ '--glow': report.summary.netProfit >= 0 ? 'rgba(14,124,107,0.25)' : 'rgba(220,38,38,0.25)' } as React.CSSProperties}>
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                Net Profit (accurate)
                {report.summary.netProfit >= 0
                  ? <TrendingUp size={13} style={{ color: '#0E7C6B' }} />
                  : <TrendingDown size={13} style={{ color: '#DC2626' }} />}
              </div>
              <span className={`ledger-amount ledger-amount--lg`} style={{ borderBottomColor: report.summary.netProfit >= 0 ? '#0E7C6B' : '#DC2626' }}>
                {report.summary.netProfit < 0 ? '-' : ''}₹{Math.abs(report.summary.netProfit).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="card p-4 mb-6 text-xs text-gray-500 space-y-1">
            <div><strong style={{ color: '#1B2540' }}>Accurate (COGS-based):</strong> sirf jo maal is period mein <em>becha</em> gaya uski cost minus hoti hai — asli profit yehi hai.</div>
            <div><strong style={{ color: '#1B2540' }}>Simple (cash-basis):</strong> is period mein jo bhi khareeda uska poora total minus — chahe wo becha ho ya stock mein pada ho. Neeche har company card mein dono number milenge.</div>
          </div>

          {report.hasUnassignedProducts && (
            <div className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(181,112,47,0.1)', color: '#8C561F' }}>
              Kuch products ka company/group set nahi hai — unki billing is report me "Unassigned" ki jagah count nahi ho rahi. Inventory me jaake group set kar do.
            </div>
          )}

          {/* Company-wise cards */}
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h3 className="font-display font-semibold text-lg">Company-wise breakdown</h3>
            {filtersActive && (
              <button className="btn btn-sm" onClick={() => { setCompanyFilter('all'); setCompanySearch(''); setStatus('all'); setSortKey('name') }}>
                Clear filters
              </button>
            )}
          </div>

          {report.companies.length === 0 ? (
            <div className="text-sm text-gray-400">Koi company nahi hai — Inventory me group/company add karo</div>
          ) : (
            <>
              <div className="card p-4 mb-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={15} className="text-gray-400" />
                    <div>
                      <label className="label mb-1">Company</label>
                      <select className="input py-1.5" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
                        <option value="all">All companies</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        {report.hasUnassignedProducts && <option value="unassigned">Unassigned</option>}
                      </select>
                    </div>
                  </div>
                  <div className="min-w-[160px]">
                    <label className="label mb-1">Search company</label>
                    <input className="input py-1.5" placeholder="e.g. Pulse" value={companySearch}
                      onChange={e => setCompanySearch(e.target.value)} />
                  </div>
                  <div>
                    <label className="label mb-1">Status</label>
                    <select className="input py-1.5" value={status} onChange={e => setStatus(e.target.value as StatusFilter)}>
                      <option value="all">All</option>
                      <option value="profit">Profit only</option>
                      <option value="loss">Loss only</option>
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1">Sort by</label>
                    <select className="input py-1.5" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
                      <option value="name">Name (A-Z)</option>
                      <option value="netProfitDesc">Highest profit first</option>
                      <option value="netProfitAsc">Highest loss first</option>
                      <option value="salesDesc">Highest sales first</option>
                      <option value="purchaseDesc">Highest purchase first</option>
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1">Profit basis (for status/sort)</label>
                    <select className="input py-1.5" value={basis} onChange={e => setBasis(e.target.value as BasisKey)}>
                      <option value="accurate">Accurate (COGS)</option>
                      <option value="simple">Simple (cash-basis)</option>
                    </select>
                  </div>
                </div>
              </div>

              {filteredCompanies.length === 0 ? (
                <div className="text-sm text-gray-400 mb-4">Filter se koi company match nahi hui</div>
              ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredCompanies.map(c => {
                const isProfit = c.netProfit >= 0
                const isSimpleProfit = c.simpleNetProfit >= 0

                return (
                  <div key={c.groupId} className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-display font-semibold text-base">{c.groupName}</h4>
                      <span className={`badge ${isProfit ? 'badge-profit' : 'badge-loss'}`}>
                        {isProfit ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {isProfit ? 'Profit' : 'Loss'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-500 block text-xs">Total Purchase</span>
                        <Amount value={c.totalPurchase} />
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs">Total Sales (bills se)</span>
                        <Amount value={c.totalSales} />
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs">Cost of Goods Sold</span>
                        <Amount value={c.costOfGoodsSold} />
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs">Expenses</span>
                        <Amount value={c.expenses} />
                      </div>
                    </div>
                    <div className="pt-3 space-y-3" style={{ borderTop: '1px solid rgba(226,229,237,0.7)' }}>
                      <div>
                        <span className="text-gray-500 block text-xs mb-0.5">Net Profit — Accurate (COGS-based)</span>
                        <span className="ledger-amount" style={{ borderBottomColor: isProfit ? '#0E7C6B' : '#DC2626', color: isProfit ? '#0E7C6B' : '#DC2626' }}>
                          {!isProfit ? '-' : ''}₹{Math.abs(c.netProfit).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs mb-0.5">Net Profit — Simple (Sales − Purchase − Expenses)</span>
                        <span className="ledger-amount" style={{ borderBottomColor: isSimpleProfit ? '#0E7C6B' : '#DC2626', color: isSimpleProfit ? '#0E7C6B' : '#DC2626' }}>
                          {!isSimpleProfit ? '-' : ''}₹{Math.abs(c.simpleNetProfit).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {c.groupId && <MonthlySalesPanel groupId={c.groupId} />}
                  </div>
                )
              })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
