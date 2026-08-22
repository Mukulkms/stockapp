import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { getProfitLossApi } from '../api/endpoints'
import { ProfitLossReport } from '../types'
import Amount from '../components/Amount'
import ProfitCalculator from '../components/ProfitCalculator'
import { todayISO } from '../lib/helpers'

function firstDayOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

const PRESETS = [
  { label: 'All time', from: '', to: '' },
  { label: 'This month', from: firstDayOfMonth(), to: todayISO() },
  { label: 'Last 30 days', from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], to: todayISO() },
  { label: 'This year', from: `${new Date().getFullYear()}-01-01`, to: todayISO() }
]

export default function Reports() {
  // Default "All time" — tum khud jab chaho date range select kar lo
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState<ProfitLossReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <h2 className="font-display font-semibold text-2xl mb-1">Profit &amp; Loss</h2>
      <p className="text-sm text-haze-500 mb-6">Company-wise dekho kitni purchase hui, kitni sale hui, aur kitna profit/loss chal raha hai</p>

      {/* Date range controls */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-haze-400" />
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
        <div className="text-sm text-haze-400">Loading...</div>
      ) : error ? (
        <div className="card p-4 text-sm" style={{ color: '#DC2626' }}>
          Report load nahi ho paya: {error}
          <button className="btn btn-sm ml-3" onClick={() => load(from, to)}>Retry</button>
        </div>
      ) : !report ? (
        <div className="text-sm text-haze-400">Kuch data nahi mila</div>
      ) : (
        <>
          {/* Overall summary tiles — sabse upar, filter ke neeche */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="stat-tile" style={{ '--glow': 'rgba(33,28,77,0.18)' } as React.CSSProperties}>
              <div className="text-xs text-haze-500 mb-1">Total Purchase</div>
              <Amount value={report.summary.totalPurchase} size="lg" />
            </div>
            <div className="stat-tile" style={{ '--glow': 'rgba(37,99,235,0.2)' } as React.CSSProperties}>
              <div className="text-xs text-haze-500 mb-1">Total Sales</div>
              <Amount value={report.summary.totalSales} size="lg" />
            </div>
            <div className="stat-tile" style={{ '--glow': report.summary.netProfit >= 0 ? 'rgba(13,148,136,0.25)' : 'rgba(220,38,38,0.25)' } as React.CSSProperties}>
              <div className="text-xs text-haze-500 mb-1 flex items-center gap-1">
                Net Profit
                {report.summary.netProfit >= 0
                  ? <TrendingUp size={13} style={{ color: '#0D9488' }} />
                  : <TrendingDown size={13} style={{ color: '#DC2626' }} />}
              </div>
              <span className="ledger-amount ledger-amount--lg" style={{ borderBottomColor: report.summary.netProfit >= 0 ? '#0D9488' : '#DC2626' }}>
                {report.summary.netProfit < 0 ? '-' : ''}₹{Math.abs(report.summary.netProfit).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {report.hasUnassignedProducts && (
            <div className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(79,70,229,0.1)', color: '#3730A3' }}>
              Kuch products ka company/group set nahi hai — unki purchase is report me "Unassigned" ki jagah count nahi ho rahi. Inventory me jaake group set kar do.
            </div>
          )}

          {/* Company-wise cards */}
          <h3 className="font-display font-semibold text-lg mb-3">Company-wise breakdown</h3>
          {report.companies.length === 0 ? (
            <div className="text-sm text-haze-400">Koi company nahi hai — Inventory me group/company add karo</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {report.companies.map(c => {
                const isProfit = c.netProfit >= 0

                return (
                  <div key={c.groupId} className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-display font-semibold text-base">{c.groupName}</h4>
                      <span className={`badge ${isProfit ? 'badge-profit' : 'badge-loss'}`}>
                        {isProfit ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {isProfit ? 'Profit' : 'Loss'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-3 text-sm mb-3">
                      <div>
                        <span className="text-haze-500 block text-xs">Total Purchase</span>
                        <Amount value={c.totalPurchase} />
                      </div>
                      <div>
                        <span className="text-haze-500 block text-xs">Total Sales</span>
                        <Amount value={c.totalSales} />
                      </div>
                      <div>
                        <span className="text-haze-500 block text-xs">Net Profit</span>
                        <span className="ledger-amount" style={{ borderBottomColor: isProfit ? '#0D9488' : '#DC2626', color: isProfit ? '#0D9488' : '#DC2626' }}>
                          {!isProfit ? '-' : ''}₹{Math.abs(c.netProfit).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {c.groupId && <ProfitCalculator groupId={c.groupId} />}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
