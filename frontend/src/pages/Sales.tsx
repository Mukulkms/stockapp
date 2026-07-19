import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, Receipt, Eye, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProductsApi, createSalesInvoiceApi, getSalesInvoicesApi, deleteSalesInvoiceApi } from '../api/endpoints'
import { Product, SalesInvoice } from '../types'
import Amount from '../components/Amount'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 10

interface LineItem {
  productId: string
  qty: number
}

export default function Sales() {
  const [products, setProducts] = useState<Product[]>([])
  const [invoices, setInvoices] = useState<SalesInvoice[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [lines, setLines] = useState<LineItem[]>([{ productId: '', qty: 1 }])
  const [saving, setSaving] = useState(false)
  const [viewing, setViewing] = useState<SalesInvoice | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [busyDelete, setBusyDelete] = useState(false)
  const [page, setPage] = useState(1)

  const load = () => {
    getProductsApi().then(setProducts)
    getSalesInvoicesApi().then(list => { setInvoices(list); setPage(1) })
  }
  useEffect(load, [])

  const addLine = () => setLines(prev => [...prev, { productId: '', qty: 1 }])
  const updateLine = (i: number, patch: Partial<LineItem>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))

  const getProduct = (id: string) => products.find(p => p.id === id)
  const total = lines.reduce((sum, l) => {
    const p = getProduct(l.productId)
    return sum + (p ? p.sellingPrice * l.qty : 0)
  }, 0)

  const submit = async () => {
    const valid = lines.filter(l => l.productId && l.qty > 0)
    if (!valid.length) { toast.error('Kam se kam ek product select karo'); return }

    setSaving(true)
    try {
      await createSalesInvoiceApi({
        customerName, customerPhone,
        items: valid.map(l => ({ productId: l.productId, qty: l.qty }))
      })
      toast.success('Bill ban gaya, stock update ho gaya ✓')
      setCustomerName(''); setCustomerPhone(''); setLines([{ productId: '', qty: 1 }])
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Bill save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async (revertStock: boolean) => {
    if (!deleteTarget) return
    setBusyDelete(true)
    try {
      await deleteSalesInvoiceApi(deleteTarget, revertStock)
      toast.success(revertStock ? 'Bill delete ho gaya, stock revert ho gaya' : 'Bill delete ho gaya')
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete nahi hua')
    } finally {
      setBusyDelete(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <h2 className="font-display font-semibold text-2xl mb-1">Sales / Billing</h2>
      <p className="text-sm text-gray-500 mb-6">Customer ko bill do — rate auto aayega, stock apne aap minus hoga</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* New bill form */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-sm mb-4">New bill</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label">Customer name</label>
              <input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3 mb-4">
            {lines.map((l, i) => {
              const p = getProduct(l.productId)
              return (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <select className="input flex-1 min-w-[140px]" value={l.productId}
                    onChange={e => updateLine(i, { productId: e.target.value })}>
                    <option value="">Select product...</option>
                    {products.map(pr => (
                      <option key={pr.id} value={pr.id} disabled={pr.stockQty <= 0}>
                        {pr.name} ({pr.stockQty} {pr.unit} left)
                      </option>
                    ))}
                  </select>
                  <input className="input w-20" type="number" min={1} value={l.qty}
                    onChange={e => updateLine(i, { qty: parseFloat(e.target.value) || 0 })} />
                  <span className="text-xs text-gray-500 w-20 shrink-0">
                    {p ? `₹${p.sellingPrice}/${p.unit}` : ''}
                  </span>
                  <button className="btn btn-sm shrink-0" onClick={() => removeLine(i)}><Trash2 size={13} /></button>
                </div>
              )
            })}
          </div>

          <button className="btn btn-sm mb-4" onClick={addLine}><Plus size={13} /> Add product</button>

          <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid #F0F1F8' }}>
            <span className="label mb-0">Total</span>
            <Amount value={total} size="lg" />
          </div>

          <button className="btn btn-primary w-full justify-center mt-4" onClick={submit} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
            Generate bill
          </button>
        </div>

        {/* Recent invoices */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-sm mb-4">Recent bills</h3>
          <div className="space-y-3">
            {invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(inv => (
              <div key={inv.id} className="pb-3" style={{ borderBottom: '1px solid #F0F1F8' }}>
                <div className="flex items-center justify-between text-sm mb-1 gap-2">
                  <span className="font-medium truncate">{inv.customerName || 'Walk-in customer'}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Amount value={inv.totalAmount} />
                    <button className="btn btn-sm" onClick={() => setViewing(inv)}><Eye size={12} /></button>
                    <button className="btn btn-sm" style={{ color: '#D9534F' }} onClick={() => setDeleteTarget(inv.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{inv.invoiceNumber} · {inv.billDate.split('T')[0]} · {inv.items.length} items</p>
              </div>
            ))}
            {invoices.length === 0 && <p className="text-xs text-gray-400">Abhi tak koi bill nahi bana.</p>}
          </div>
          <Pagination page={page} totalItems={invoices.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      {viewing && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(30,42,94,0.4)' }}>
          <div className="card p-5 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">Bill details</h3>
              <button className="btn btn-sm" onClick={() => setViewing(null)}><X size={14} /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
              <div><span className="text-gray-500">Customer: </span>{viewing.customerName || 'Walk-in customer'}</div>
              <div><span className="text-gray-500">Phone: </span>{viewing.customerPhone || '—'}</div>
              <div><span className="text-gray-500">Invoice #: </span>{viewing.invoiceNumber}</div>
              <div><span className="text-gray-500">Date: </span>{new Date(viewing.billDate).toLocaleDateString('en-IN')}</div>
            </div>

            <div className="card overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[380px]">
                  <thead>
                    <tr style={{ background: '#F7F8FB', borderBottom: '1px solid #E4E7F1' }}>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Rate</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.items.map(it => (
                      <tr key={it.id} style={{ borderBottom: '1px solid #F0F1F8' }}>
                        <td className="px-3 py-2">{it.product?.name || '—'}</td>
                        <td className="px-3 py-2">{it.qty} {it.product?.unit}</td>
                        <td className="px-3 py-2"><Amount value={it.rate} /></td>
                        <td className="px-3 py-2"><Amount value={it.qty * it.rate} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm font-medium pt-3" style={{ borderTop: '1px solid #F0F1F8' }}>
              <span>Total</span>
              <Amount value={viewing.totalAmount} size="lg" />
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Bill delete karein?"
          message="Yeh sales bill permanently delete ho jayega."
          revertLabel="Is bill mein jo stock minus hua tha, wo bhi wapas add kar do (recommended)"
          busy={busyDelete}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}
