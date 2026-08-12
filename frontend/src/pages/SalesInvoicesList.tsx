import { useEffect, useState, useMemo } from 'react'
import { Trash2, Pencil, Eye, X, Check, Loader2, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getSalesInvoicesApi, updateSalesInvoiceApi, deleteSalesInvoiceApi,
  bulkDeleteSalesInvoicesApi
} from '../api/endpoints'
import { SalesInvoice } from '../types'
import Amount from '../components/Amount'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import Pagination from '../components/Pagination'
import { generateSalesInvoicePDF } from '../lib/pdf'

const PAGE_SIZE = 10

interface EditItem {
  productId: string
  name: string
  qty: number
  rate: number
}

export default function SalesInvoicesList() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewing, setViewing] = useState<SalesInvoice | null>(null)
  const [editing, setEditing] = useState<SalesInvoice | null>(null)
  const [editFields, setEditFields] = useState<any>({})
  const [editItems, setEditItems] = useState<EditItem[]>([])
  const [saving, setSaving] = useState(false)
  const [busyDelete, setBusyDelete] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [page, setPage] = useState(1)

  const load = () => {
    setLoading(true)
    getSalesInvoicesApi().then(list => { setInvoices(list); setPage(1) }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const allSelected = invoices.length > 0 && selected.size === invoices.length

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(invoices.map(i => i.id)))
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const confirmDeleteOne = async (revertStock: boolean) => {
    if (!deleteTarget) return
    setBusyDelete(true)
    try {
      await deleteSalesInvoiceApi(deleteTarget, revertStock)
      toast.success(revertStock ? 'Bill delete ho gaya, stock wapas add ho gaya' : 'Bill delete ho gaya')
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete nahi hua')
    } finally {
      setBusyDelete(false)
    }
  }

  const confirmDeleteBulk = async (revertStock: boolean) => {
    if (!selected.size) return
    setBusyDelete(true)
    try {
      await bulkDeleteSalesInvoicesApi(Array.from(selected), revertStock)
      toast.success(revertStock ? 'Selected bills delete ho gaye, stock wapas add ho gaya' : 'Selected bills delete ho gaye')
      setSelected(new Set())
      setBulkDeleteOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Bulk delete nahi hua')
    } finally {
      setBusyDelete(false)
    }
  }

  const openEdit = (inv: SalesInvoice) => {
    setEditing(inv)
    setEditFields({
      invoiceNumber: inv.invoiceNumber || '',
      customerName: inv.customerName || '',
      customerGSTIN: inv.customerGSTIN || '',
      customerPhone: inv.customerPhone || '',
      customerAddress: inv.customerAddress || '',
      discountAmount: inv.discountAmount || 0,
      taxAmount: inv.taxAmount || 0,
      totalAmount: inv.totalAmount || 0
    })
    setEditItems(inv.items.map(it => ({
      productId: it.productId,
      name: it.product?.name || '',
      qty: it.qty,
      rate: it.rate
    })))
  }

  const closeEdit = () => { setEditing(null); setEditFields({}); setEditItems([]) }

  const updateEditItem = (i: number, patch: Partial<EditItem>) => {
    setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }
  const removeEditItem = (i: number) => setEditItems(prev => prev.filter((_, idx) => idx !== i))

  const saveEdit = async () => {
    if (!editing) return
    if (!editItems.length) { toast.error('Kam se kam ek item chahiye'); return }
    setSaving(true)
    try {
      await updateSalesInvoiceApi(editing.id, {
        ...editFields,
        items: editItems.map(it => ({ productId: it.productId, qty: it.qty, rate: it.rate }))
      })
      toast.success('Bill update ho gaya, stock adjust ho gaya')
      closeEdit()
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Update nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const editSubTotal = useMemo(
    () => editItems.reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0),
    [editItems]
  )

  const pageItems = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <h2 className="font-display font-semibold text-2xl">Sales Bills</h2>
        {selected.size > 0 && (
          <button className="btn" style={{ borderColor: '#DC2626', color: '#DC2626' }}
            onClick={() => setBulkDeleteOpen(true)} disabled={busyDelete}>
            {busyDelete ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete selected ({selected.size})
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">Purane bills dekho, edit karo, PDF dubara download karo ya delete karo</p>

      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : invoices.length === 0 ? (
        <div className="text-sm text-gray-400">Koi sales bill nahi hai abhi</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr style={{ background: 'rgba(245,246,250,0.6)', borderBottom: '1px solid rgba(226,229,237,0.7)' }}>
                  <th className="px-4 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Customer</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Invoice #</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid rgba(238,240,246,0.7)' }}>
                    <td className="px-4 py-2.5"><input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleOne(inv.id)} /></td>
                    <td className="px-4 py-2.5">{new Date(inv.billDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-2.5">{inv.customerName || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{inv.invoiceNumber}</td>
                    <td className="px-4 py-2.5"><Amount value={inv.totalAmount} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5 justify-end">
                        <button className="btn btn-sm" onClick={() => setViewing(inv)}><Eye size={13} /></button>
                        <button className="btn btn-sm" onClick={() => generateSalesInvoicePDF(inv)}><FileDown size={13} /></button>
                        <button className="btn btn-sm" onClick={() => openEdit(inv)}><Pencil size={13} /></button>
                        <button className="btn btn-sm" style={{ color: '#DC2626' }} onClick={() => setDeleteTarget(inv.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalItems={invoices.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      {/* View modal */}
      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal p-5 sm:p-6 max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">Bill #{viewing.invoiceNumber}</h3>
              <button className="btn btn-sm" onClick={() => setViewing(null)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><span className="text-gray-500">Customer: </span>{viewing.customerName || '—'}</div>
              <div><span className="text-gray-500">Date: </span>{new Date(viewing.billDate).toLocaleDateString('en-IN')}</div>
            </div>

            <div className="card overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr style={{ background: 'rgba(245,246,250,0.6)', borderBottom: '1px solid rgba(226,229,237,0.7)' }}>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Rate</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.items.map(it => (
                      <tr key={it.id} style={{ borderBottom: '1px solid rgba(238,240,246,0.7)' }}>
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
              <div><span className="text-gray-500 block text-xs">Sub total</span><Amount value={viewing.subTotal} /></div>
              <div><span className="text-gray-500 block text-xs">Discount</span><Amount value={viewing.discountAmount} /></div>
              <div><span className="text-gray-500 block text-xs">Tax</span><Amount value={viewing.taxAmount} /></div>
              <div><span className="text-gray-500 block text-xs">Total</span><Amount value={viewing.totalAmount} /></div>
            </div>

            <button className="btn btn-accent mb-4" onClick={() => generateSalesInvoicePDF(viewing)}>
              <FileDown size={14} /> Download PDF
            </button>

            {viewing.imageUrl && (
              <div>
                <span className="label">Bill image</span>
                <img src={viewing.imageUrl} alt="Bill" className="rounded-lg border max-w-full" style={{ borderColor: '#E2E5ED' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal p-5 sm:p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">Edit Sales Bill</h3>
              <button className="btn btn-sm" onClick={closeEdit}><X size={14} /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Customer name</label>
                <input className="input" value={editFields.customerName}
                  onChange={e => setEditFields({ ...editFields, customerName: e.target.value })} />
              </div>
              <div>
                <label className="label">Invoice number</label>
                <input className="input" value={editFields.invoiceNumber}
                  onChange={e => setEditFields({ ...editFields, invoiceNumber: e.target.value })} />
              </div>
              <div>
                <label className="label">Customer GST</label>
                <input className="input" value={editFields.customerGSTIN}
                  onChange={e => setEditFields({ ...editFields, customerGSTIN: e.target.value })} />
              </div>
              <div>
                <label className="label">Customer phone</label>
                <input className="input" value={editFields.customerPhone}
                  onChange={e => setEditFields({ ...editFields, customerPhone: e.target.value })} />
              </div>
            </div>

            <div className="card overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr style={{ background: 'rgba(245,246,250,0.6)', borderBottom: '1px solid rgba(226,229,237,0.7)' }}>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Rate</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editItems.map((it, i) => (
                      <tr key={it.productId + i} style={{ borderBottom: '1px solid rgba(238,240,246,0.7)' }}>
                        <td className="px-3 py-2">{it.name}</td>
                        <td className="px-3 py-2">
                          <input className="input py-1.5 w-20" type="number" min={0} value={it.qty}
                            onChange={e => updateEditItem(i, { qty: Math.max(0, parseFloat(e.target.value) || 0) })} />
                        </td>
                        <td className="px-3 py-2">
                          <input className="input py-1.5 w-24" type="number" min={0} value={it.rate}
                            onChange={e => updateEditItem(i, { rate: Math.max(0, parseFloat(e.target.value) || 0) })} />
                        </td>
                        <td className="px-3 py-2">
                          <button className="btn btn-sm" onClick={() => removeEditItem(i)}><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-4">Naya item add karna ho to Sales page se naya bill banao. Yaha existing items ki qty/rate edit ya remove kar sakte ho.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
              <div>
                <label className="label">Items total (calculated)</label>
                <div className="input py-1.5 flex items-center"><Amount value={editSubTotal} /></div>
              </div>
              <div>
                <label className="label">Discount</label>
                <input className="input" type="number" min={0} value={editFields.discountAmount}
                  onChange={e => setEditFields({ ...editFields, discountAmount: Math.max(0, parseFloat(e.target.value) || 0) })} />
              </div>
              <div>
                <label className="label">Tax / GST amount</label>
                <input className="input" type="number" min={0} value={editFields.taxAmount}
                  onChange={e => setEditFields({ ...editFields, taxAmount: Math.max(0, parseFloat(e.target.value) || 0) })} />
              </div>
            </div>
            <div className="mb-5">
              <label className="label">Final bill amount (editable)</label>
              <input className="input font-medium" type="number" min={0} value={editFields.totalAmount}
                onChange={e => setEditFields({ ...editFields, totalAmount: Math.max(0, parseFloat(e.target.value) || 0) })} />
            </div>

            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={closeEdit}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Sales bill delete karein?"
          message="Yeh bill permanently delete ho jayega."
          revertLabel="Is bill se jo stock kam hua tha, wo wapas add kar do (recommended)"
          busy={busyDelete}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteOne}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmDeleteModal
          title={`${selected.size} bills delete karein?`}
          message="Selected bills permanently delete ho jayenge."
          revertLabel="In bills se jo stock kam hua tha, wo wapas add kar do (recommended)"
          busy={busyDelete}
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={confirmDeleteBulk}
        />
      )}
    </div>
  )
}
