import { useEffect, useState } from 'react'
import { Loader2, Save, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { getMonthlyBreakdownApi, saveMonthlySalesApi } from '../api/endpoints'
import { MonthlyBreakdownRow } from '../types'
import Amount from './Amount'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function currentMonthValue(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Company card ke andar ek collapsible panel — har mahine ka purchase/expense
// automatically bills se aata hai, sales tum khud daalte/save karte ho (kyunki
// abhi Sales Invoice module nahi hai). Ek baar save karne ke baad wo permanently
// database mein rehta hai, refresh pe gayab nahi hota.
export default function MonthlySalesPanel({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [months, setMonths] = useState<MonthlyBreakdownRow[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({}) // "year-month" -> typed value
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [newMonth, setNewMonth] = useState(currentMonthValue())
  const [newAmount, setNewAmount] = useState('')
  const [addingNew, setAddingNew] = useState(false)

  const keyOf = (y: number, m: number) => `${y}-${m}`

  const load = () => {
    setLoading(true)
    getMonthlyBreakdownApi(groupId)
      .then(d => setMonths(d.months || []))
      .catch(() => toast.error('Month-wise data load nahi hua'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (open) load() }, [open]) // eslint-disable-line

  const save = async (year: number, month: number, amountStr: string) => {
    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount < 0) { toast.error('Sahi sales amount daalo'); return }
    const k = keyOf(year, month)
    setSavingKey(k)
    try {
      await saveMonthlySalesApi({ groupId, year, month, salesAmount: amount })
      toast.success(`${MONTH_NAMES[month - 1]} ${year} ki sales save ho gayi`)
      setEdits(prev => { const n = { ...prev }; delete n[k]; return n })
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save nahi hua')
    } finally {
      setSavingKey(null)
    }
  }

  const addNewMonth = async () => {
    if (!newMonth) return
    const [yStr, mStr] = newMonth.split('-')
    const y = +yStr, m = +mStr
    if (!newAmount) { toast.error('Sales amount daalo'); return }
    setAddingNew(true)
    try {
      await save(y, m, newAmount)
      setNewAmount('')
    } finally {
      setAddingNew(false)
    }
  }

  return (
    <div className="pt-3 mt-3" style={{ borderTop: '1px dashed rgba(226,229,237,0.9)' }}>
      <button className="btn btn-sm w-full justify-center" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        Month-wise sales & profit {open ? 'chhupao' : 'dekho / daalo'}
      </button>

      {open && (
        <div className="mt-3">
          {/* Add / update a month's sales */}
          <div className="flex gap-2 mb-3">
            <input className="input py-1.5 text-sm" type="month" value={newMonth}
              max={currentMonthValue()} onChange={e => setNewMonth(e.target.value)} />
            <input className="input py-1.5 text-sm flex-1" type="number" min={0} placeholder="Sales amount (e.g. 32000)"
              value={newAmount} onChange={e => setNewAmount(e.target.value)} />
            <button className="btn btn-sm" onClick={addNewMonth} disabled={addingNew}>
              {addingNew ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Save
            </button>
          </div>

          {loading ? (
            <div className="text-xs text-gray-400">Loading...</div>
          ) : months.length === 0 ? (
            <div className="text-xs text-gray-400">Abhi is company ka koi purchase/expense/sales data nahi hai. Upar se ek month select karke sales daalo.</div>
          ) : (
            <div className="space-y-2">
              {months.map(row => {
                const k = keyOf(row.year, row.month)
                const editVal = edits[k] !== undefined ? edits[k] : (row.hasSalesEntry ? String(row.salesAmount) : '')
                const isProfit = row.netProfit >= 0
                const hasAnySales = row.hasSalesEntry
                return (
                  <div key={k} className="rounded-lg p-2.5" style={{ background: '#F8F9FC' }}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium" style={{ color: '#1B2540' }}>{MONTH_NAMES[row.month - 1]} {row.year}</span>
                      {hasAnySales && (
                        <span style={{ color: isProfit ? '#0E7C6B' : '#DC2626' }}>
                          {!isProfit ? '-' : ''}₹{Math.abs(row.netProfit).toLocaleString('en-IN')} {isProfit ? 'profit' : 'loss'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500 mb-2">
                      <div>Purchase: <Amount value={row.purchaseTotal} /></div>
                      <div>Expenses: <Amount value={row.expensesTotal} /></div>
                    </div>
                    <div className="flex gap-2">
                      <input className="input py-1 text-xs flex-1" type="number" min={0}
                        placeholder="Is mahine ki sales daalo"
                        value={editVal} onChange={e => setEdits(prev => ({ ...prev, [k]: e.target.value }))} />
                      <button className="btn btn-sm" onClick={() => save(row.year, row.month, editVal)} disabled={savingKey === k || !editVal}>
                        {savingKey === k ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
