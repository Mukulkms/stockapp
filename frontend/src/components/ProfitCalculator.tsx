import { useEffect, useState } from 'react'
import { Calculator, ChevronDown, ChevronUp, Loader2, Save, RefreshCw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getMonthlyBreakdownApi, getChequesApi,
  getProfitCalculationsApi, saveProfitCalculationApi, deleteProfitCalculationApi
} from '../api/endpoints'
import { ProfitCalculation } from '../types'
import Amount from './Amount'

function currentMonthValue(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

// "2026-07" se "2026-08" tak ka poora din-wise date range: "1 Jul 2026 – 31 Aug 2026"
// (kis din se kis din tak ki sales is period mein daali gayi hai, wahi dikhata hai)
function fullRangeLabel(fromMonth: string, toMonth: string) {
  const [fy, fm] = fromMonth.split('-').map(Number)
  const [ty, tm] = toMonth.split('-').map(Number)
  const daysInMonth = new Date(ty, tm, 0).getDate()
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const start = fmt(new Date(fy, fm - 1, 1))
  const end = fmt(new Date(ty, tm - 1, daysInMonth))
  return `${start} – ${end}`
}

// Ek company/group ke liye: kisi bhi period (ek mahina, kayi mahine, ya poora saal)
// ki total sale + us period mein diye gaye cheques ka total automatically jod ke
// laata hai. Bacha hua stock value tum khud daalte ho. In teenon se net profit
// nikal ke period ke saath save ho jata hai — agli baar naya period, naya save.
export default function ProfitCalculator({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false)
  const [periodType, setPeriodType] = useState<'monthly' | 'range'>('monthly')
  const [fromMonth, setFromMonth] = useState(currentMonthValue())
  const [toMonth, setToMonth] = useState(currentMonthValue())

  const [fetching, setFetching] = useState(false)
  const [totalSales, setTotalSales] = useState('')
  const [totalCheques, setTotalCheques] = useState('')
  const [stockValue, setStockValue] = useState('')
  const [fetched, setFetched] = useState(false)

  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<ProfitCalculation[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadHistory = () => {
    setHistoryLoading(true)
    getProfitCalculationsApi(groupId)
      .then(setHistory)
      .catch(() => toast.error('Purane calculations load nahi hue'))
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => { if (open) loadHistory() }, [open]) // eslint-disable-line

  const effectiveToMonth = periodType === 'monthly' ? fromMonth : toMonth

  const fetchData = async () => {
    if (effectiveToMonth < fromMonth) { toast.error('"To" month "From" se pehle nahi ho sakta'); return }
    setFetching(true)
    try {
      const [breakdown, cheques] = await Promise.all([getMonthlyBreakdownApi(groupId), getChequesApi()])

      const inRange = (y: number, m: number) => {
        const key = `${y}-${String(m).padStart(2, '0')}`
        return key >= fromMonth && key <= effectiveToMonth
      }

      const salesSum = (breakdown.months || [])
        .filter((row: any) => row.hasSalesEntry && inRange(row.year, row.month))
        .reduce((s: number, row: any) => s + row.salesAmount, 0)

      const rangeStart = new Date(+fromMonth.split('-')[0], +fromMonth.split('-')[1] - 1, 1)
      const rangeEnd = new Date(+effectiveToMonth.split('-')[0], +effectiveToMonth.split('-')[1], 0, 23, 59, 59)
      const chequesSum = (cheques || [])
        .filter((c: any) => c.groupId === groupId)
        .filter((c: any) => {
          const d = new Date(c.chequeDate)
          return d >= rangeStart && d <= rangeEnd
        })
        .reduce((s: number, c: any) => s + c.amount, 0)

      setTotalSales(String(+salesSum.toFixed(2)))
      setTotalCheques(String(+chequesSum.toFixed(2)))
      setFetched(true)
      toast.success('Sale aur cheque data aa gaya, ab stock value daalo')
    } catch (e: any) {
      toast.error('Data fetch nahi hua')
    } finally {
      setFetching(false)
    }
  }

  const salesNum = parseFloat(totalSales) || 0
  const chequesNum = parseFloat(totalCheques) || 0
  const stockNum = parseFloat(stockValue) || 0
  const netProfit = +(salesNum - chequesNum + stockNum).toFixed(2)
  const isProfit = netProfit >= 0

  const save = async () => {
    if (!fetched) { toast.error('Pehle "Sale + Cheque nikaalo" dabao'); return }
    setSaving(true)
    try {
      await saveProfitCalculationApi({
        groupId, periodType, fromMonth, toMonth: effectiveToMonth,
        totalSales: salesNum, totalCheques: chequesNum, stockValue: stockNum
      })
      toast.success(`${monthLabel(fromMonth)}${fromMonth !== effectiveToMonth ? ' – ' + monthLabel(effectiveToMonth) : ''} ka profit save ho gaya`)
      setFetched(false)
      setTotalSales(''); setTotalCheques(''); setStockValue('')
      loadHistory()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const removeCalc = async (id: string) => {
    try {
      await deleteProfitCalculationApi(id)
      toast.success('Delete ho gaya')
      loadHistory()
    } catch {
      toast.error('Delete nahi hua')
    }
  }

  return (
    <div className="pt-3 mt-3" style={{ borderTop: '1px dashed rgba(227,223,250,0.9)' }}>
      <button className="btn btn-sm w-full justify-center" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        <Calculator size={13} />
        Cheque-based profit calculator {open ? 'chhupao' : 'dekho'}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label mb-1">Period</label>
              <select className="input py-1.5 text-sm" value={periodType}
                onChange={e => { setPeriodType(e.target.value as any); setFetched(false) }}>
                <option value="monthly">Ek mahina</option>
                <option value="range">Kayi mahine / Saal</option>
              </select>
            </div>
            <div>
              <label className="label mb-1">{periodType === 'monthly' ? 'Month' : 'From'}</label>
              <input className="input py-1.5 text-sm" type="month" value={fromMonth}
                max={currentMonthValue()} onChange={e => { setFromMonth(e.target.value); setFetched(false) }} />
            </div>
            {periodType === 'range' && (
              <div>
                <label className="label mb-1">To</label>
                <input className="input py-1.5 text-sm" type="month" value={toMonth}
                  max={currentMonthValue()} onChange={e => { setToMonth(e.target.value); setFetched(false) }} />
              </div>
            )}
            <button className="btn btn-sm" onClick={fetchData} disabled={fetching}>
              {fetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Sale + Cheque nikaalo
            </button>
          </div>

          {fetched && (
            <div className="rounded-lg p-3 space-y-2.5" style={{ background: '#F7F5FE' }}>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="label mb-1">Total sale ({periodType === 'monthly' ? monthLabel(fromMonth) : `${monthLabel(fromMonth)} – ${monthLabel(effectiveToMonth)}`})</label>
                  <input className="input py-1.5 text-sm" type="number" min={0} value={totalSales}
                    onChange={e => setTotalSales(e.target.value)} />
                </div>
                <div>
                  <label className="label mb-1">Total cheque amount</label>
                  <input className="input py-1.5 text-sm" type="number" min={0} value={totalCheques}
                    onChange={e => setTotalCheques(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label mb-1">Abhi ka bacha hua stock (value ₹ mein)</label>
                <input className="input py-1.5 text-sm" type="number" min={0} placeholder="e.g. 18000"
                  value={stockValue} onChange={e => setStockValue(e.target.value)} />
              </div>
              <div className="pt-2" style={{ borderTop: '1px dashed rgba(227,223,250,0.9)' }}>
                <span className="text-haze-500 block text-xs mb-0.5">Net Profit (Sale − Cheque + Stock)</span>
                <span className="ledger-amount ledger-amount--lg" style={{ borderBottomColor: isProfit ? '#0D9488' : '#DC2626', color: isProfit ? '#0D9488' : '#DC2626' }}>
                  {!isProfit ? '-' : ''}₹{Math.abs(netProfit).toLocaleString('en-IN')}
                </span>
              </div>
              <button className="btn btn-primary btn-sm w-full justify-center" onClick={save} disabled={saving}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Is period ka profit save karo
              </button>
            </div>
          )}

          {/* Saved history */}
          <div>
            <div className="text-xs font-medium text-haze-500 mb-1.5">Pehle se saved periods</div>
            {historyLoading ? (
              <div className="text-xs text-haze-400">Loading...</div>
            ) : history.length === 0 ? (
              <div className="text-xs text-haze-400">Abhi koi period save nahi hua</div>
            ) : (
              <div className="space-y-1.5">
                {history.map(h => {
                  const hProfit = h.netProfit >= 0
                  return (
                    <div key={h.id} className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs" style={{ background: '#F7F5FE' }}>
                      <div>
                        <div className="font-medium" style={{ color: '#211C4D' }}>
                          {monthLabel(h.fromMonth)}{h.fromMonth !== h.toMonth ? ` – ${monthLabel(h.toMonth)}` : ''}
                        </div>
                        <div className="text-haze-500 text-[10px] mb-0.5">{fullRangeLabel(h.fromMonth, h.toMonth)}</div>
                        <div className="text-haze-500">Sale <Amount value={h.totalSales} /> · Cheque <Amount value={h.totalCheques} /> · Stock <Amount value={h.stockValue} /></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ color: hProfit ? '#0D9488' : '#DC2626' }} className="font-medium">
                          {!hProfit ? '-' : ''}₹{Math.abs(h.netProfit).toLocaleString('en-IN')}
                        </span>
                        <button className="opacity-50 hover:opacity-100" onClick={() => removeCalc(h.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
