import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { getProfitLossApi } from '../api/endpoints'
import { ProfitLossReport } from '../types'
import Amount from '../components/Amount'
import { todayISO } from '../lib/helpers'

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

  const load = (f: string, t: string) => {
    setLoading(true)
    getProfitLossApi(f || undefined, t || undefined).then(setReport).finally(() => setLoading(false))
  }

  useEffect(() => { load(from, to) }, []) // eslint-disable-line

  const applyPreset = (p: typeof PRESETS[number]) => {
    setFrom(p.from); setTo(p.to); load(p.from, p.to)
  }

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

      {loading || !report ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : (
        <>
          {/* Overall summary tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                Net Profit / Loss
                {report.summary.netProfit >= 0
                  ? <TrendingUp size={13} style={{ color: '#0E7C6B' }} />
                  : <TrendingDown size={13} style={{ color: '#DC2626' }} />}
              </div>
              <span className={`ledger-amount ledger-amount--lg`} style={{ borderBottomColor: report.summary.netProfit >= 0 ? '#0E7C6B' : '#DC2626' }}>
                {report.summary.netProfit < 0 ? '-' : ''}₹{Math.abs(report.summary.netProfit).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {report.hasUnassignedProducts && (
            <div className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(181,112,47,0.1)', color: '#8C561F' }}>
              Kuch products ka company/group set nahi hai — unki billing is report me "Unassigned" ki jagah count nahi ho rahi. Inventory me jaake group set kar do.
            </div>
          )}

          {/* Company-wise cards */}
          <h3 className="font-display font-semibold text-lg mb-3">Company-wise breakdown</h3>
          {report.companies.length === 0 ? (
            <div className="text-sm text-gray-400">Koi company nahi hai — Inventory me group/company add karo</div>
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
                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-500 block text-xs">Total Purchase</span>
                        <Amount value={c.totalPurchase} />
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs">Total Sales</span>
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
                    <div className="pt-3" style={{ borderTop: '1px solid rgba(226,229,237,0.7)' }}>
                      <span className="text-gray-500 block text-xs mb-0.5">Net Profit / Loss</span>
                      <span className="ledger-amount ledger-amount--lg" style={{ borderBottomColor: isProfit ? '#0E7C6B' : '#DC2626', color: isProfit ? '#0E7C6B' : '#DC2626' }}>
                        {!isProfit ? '-' : ''}₹{Math.abs(c.netProfit).toLocaleString('en-IN')}
                      </span>
                    </div>
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
