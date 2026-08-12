import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { getExpensesApi, createExpenseApi, deleteExpenseApi, getGroupsApi } from '../api/endpoints'
import { Expense, BillingGroup } from '../types'
import Amount from '../components/Amount'
import { todayISO } from '../lib/helpers'

const CATEGORIES = ['general', 'rent', 'salary', 'transport', 'electricity', 'maintenance', 'misc']

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [groups, setGroups] = useState<BillingGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')
  const [amount, setAmount] = useState<number | ''>('')
  const [groupId, setGroupId] = useState('')
  const [note, setNote] = useState('')
  const [expenseDate, setExpenseDate] = useState(todayISO())

  const load = () => {
    setLoading(true)
    getExpensesApi().then(setExpenses).finally(() => setLoading(false))
  }

  useEffect(() => { load(); getGroupsApi().then(setGroups) }, [])

  const resetForm = () => {
    setTitle(''); setCategory('general'); setAmount(''); setGroupId(''); setNote(''); setExpenseDate(todayISO())
  }

  const save = async () => {
    if (!title.trim()) { toast.error('Expense ka naam daalo'); return }
    if (!amount || Number(amount) <= 0) { toast.error('Amount 0 se zyada honi chahiye'); return }
    setSaving(true)
    try {
      await createExpenseApi({ title, category, amount, groupId: groupId || undefined, note, expenseDate })
      toast.success('Expense add ho gaya')
      resetForm()
      setShowForm(false)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteExpenseApi(id)
      toast.success('Expense delete ho gaya')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete nahi hua')
    } finally {
      setDeletingId(null)
    }
  }

  const totalThisMonth = expenses
    .filter(e => new Date(e.expenseDate).getMonth() === new Date().getMonth() && new Date(e.expenseDate).getFullYear() === new Date().getFullYear())
    .reduce((s, e) => s + e.amount, 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <h2 className="font-display font-semibold text-2xl">Expenses</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Add expense
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">Rent, salary, transport wagera track karo — profit/loss calculator me ye automatically minus honge</p>

      <div className="stat-tile mb-6" style={{ '--glow': 'rgba(220,38,38,0.2)' } as React.CSSProperties}>
        <div className="text-xs text-gray-500 mb-1">Is mahine ka total expense</div>
        <Amount value={totalThisMonth} size="lg" />
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : expenses.length === 0 ? (
        <div className="text-sm text-gray-400">Koi expense record nahi hai abhi</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr style={{ background: 'rgba(245,246,250,0.6)', borderBottom: '1px solid rgba(226,229,237,0.7)' }}>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Title</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Category</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Company</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid rgba(238,240,246,0.7)' }}>
                    <td className="px-4 py-2.5">{new Date(e.expenseDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-2.5">{e.title}</td>
                    <td className="px-4 py-2.5">
                      <span className="badge" style={{ background: 'rgba(27,37,64,0.08)', color: '#1B2540' }}>{e.category}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{e.group?.name || 'General'}</td>
                    <td className="px-4 py-2.5"><Amount value={e.amount} /></td>
                    <td className="px-4 py-2.5">
                      <button className="btn btn-sm" style={{ color: '#DC2626' }} onClick={() => remove(e.id)} disabled={deletingId === e.id}>
                        {deletingId === e.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal p-5 sm:p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">Add expense</h3>
              <button className="btn btn-sm" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Title</label>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Shop rent, Diesel" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Amount</label>
                  <input className="input" type="number" min={0} value={amount}
                    onChange={e => setAmount(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Company (optional)</label>
                  <select className="input" value={groupId} onChange={e => setGroupId(e.target.value)}>
                    <option value="">General (koi company nahi)</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Date</label>
                  <input className="input" type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <input className="input" value={note} onChange={e => setNote(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
