import { useEffect, useState, useMemo } from 'react'
import { Trash2, Pencil, Eye, X, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getPurchaseInvoicesApi, updatePurchaseInvoiceApi, deletePurchaseInvoiceApi,
  bulkDeletePurchaseInvoicesApi
} from '../api/endpoints'
import { PurchaseInvoice } from '../types'
import Amount from '../components/Amount'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 10

interface EditItem {
  productId: string
  name: string
  qty: number
  costPrice: number
  groupId?: string
}

export default function PurchaseInvoicesList() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewing, setViewing] = useState<PurchaseInvoice | null>(null)
  const [editing, setEditing] = useState<PurchaseInvoice | null>(null)
  const [editFields, setEditFields] = useState<any>({})
  const [editItems, setEditItems] = useState<EditItem[]>([])
  const [saving, setSaving] = useState(false)
  const [busyDelete, setBusyDelete] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [page, setPage] = useState(1)

  const load = () => {
    setLoading(true)
    getPurchaseInvoicesApi().then(list => { setInvoices(list); setPage(1) }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const allSelected = invoices.length > 0 && selected.size === invoices.length

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(invoices.map(i => i.id)))
  }
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
      await deletePurchaseInvoiceApi(deleteTarget, revertStock)
      toast.success(revertStock ? 'Invoice delete ho gaya, stock revert ho gaya' : 'Invoice delete ho gaya')
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
      await bulkDeletePurchaseInvoicesApi(Array.from(selected), revertStock)
      toast.success(revertStock ? 'Selected invoices delete ho gaye, stock revert ho gaya' : 'Selected invoices delete ho gaye')
      setSelected(new Set())
      setBulkDeleteOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Bulk delete nahi hua')
    } finally {
      setBusyDelete(false)
    }
  }

  const openEdit = (inv: PurchaseInvoice) => {
    setEditing(inv)
    setEditFields({
      invoiceNumber: inv.invoiceNumber || '',
      vendorName: inv.vendorName || '',
      vendorGSTIN: inv.vendorGSTIN || '',
      vendorPhone: inv.vendorPhone || '',
      vendorAddress: inv.vendorAddress || '',
      discountAmount: inv.discountAmount || 0,
      taxAmount: inv.taxAmount || 0,
      totalAmount: inv.totalAmount || 0
    })
    setEditItems(inv.items.map(it => ({
      productId: it.productId,
      name: it.product?.name || '',
      qty: it.qty,
      costPrice: it.costPrice,
      groupId: it.product?.groupId
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
      await updatePurchaseInvoiceApi(editing.id, {
        ...editFields,
        items: editItems.map(it => ({
          productId: it.productId,
          qty: it.qty,
          costPrice: it.costPrice
        }))
      })
      toast.success('Invoice update ho gaya, stock adjust ho gaya')
      closeEdit()
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Update nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const editSubTotal = useMemo(
    () => editItems.reduce((s, it) => s + (it.qty || 0) * (it.costPrice || 0), 0),
    [editItems]
  )

  const pageItems = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <h2 className="font-display font-semibold text-2xl">Purchase Invoices</h2>
        {selected.size > 0 && (
          <button className="btn" style={{ borderColor: '#D9534F', color: '#D9534F' }}
            onClick={() => setBulkDeleteOpen(true)} disabled={busyDelete}>
            {busyDelete ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete selected ({selected.size})
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">Purane bills dekho, edit karo, ya ek saath delete karo</p>

      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : invoices.length === 0 ? (
        <div className="text-sm text-gray-400">Koi purchase invoice nahi hai abhi</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr style={{ background: '#F7F8FB', borderBottom: '1px solid #E4E7F1' }}>
                  <th className="px-4 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Vendor</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Invoice #</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">GSTIN</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Items</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Total</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #F0F1F8' }}>
                    <td className="px-4 py-2"><input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleOne(inv.id)} /></td>
                    <td className="px-4 py-2">{new Date(inv.billDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-2">{inv.vendorName || '—'}</td>
                    <td className="px-4 py-2">{inv.invoiceNumber || '—'}</td>
                    <td className="px-4 py-2">{inv.vendorGSTIN || '—'}</td>
                    <td className="px-4 py-2">{inv.items.length}</td>
                    <td className="px-4 py-2"><Amount value={inv.totalAmount} /></td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button className="btn btn-sm" onClick={() => setViewing(inv)}><Eye size={13} /></button>
                        <button className="btn btn-sm" onClick={() => openEdit(inv)}><Pencil size={13} /></button>
                        <button className="btn btn-sm" style={{ color: '#D9534F' }} onClick={() => setDeleteTarget(inv.id)}><Trash2 size={13} /></button>
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

      {/* View (read-only) modal */}
      {viewing && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(30,42,94,0.4)' }}>
          <div className="card p-5 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">Invoice details</h3>
              <button className="btn btn-sm" onClick={() => setViewing(null)}><X size={14} /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
              <div><span className="text-gray-500">Vendor: </span>{viewing.vendorName || '—'}</div>
              <div><span className="text-gray-500">Invoice #: </span>{viewing.invoiceNumber || '—'}</div>
              <div><span className="text-gray-500">GSTIN: </span>{viewing.vendorGSTIN || '—'}</div>
              <div><span className="text-gray-500">Phone: </span>{viewing.vendorPhone || '—'}</div>
              <div className="sm:col-span-2"><span className="text-gray-500">Address: </span>{viewing.vendorAddress || '—'}</div>
              <div><span className="text-gray-500">Date: </span>{new Date(viewing.billDate).toLocaleDateString('en-IN')}</div>
            </div>

            <div className="card overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr style={{ background: '#F7F8FB', borderBottom: '1px solid #E4E7F1' }}>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Cost</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.items.map(it => (
                      <tr key={it.id} style={{ borderBottom: '1px solid #F0F1F8' }}>
                        <td className="px-3 py-2">{it.product?.name || '—'}</td>
                        <td className="px-3 py-2">{it.qty} {it.product?.unit}</td>
                        <td className="px-3 py-2"><Amount value={it.costPrice} /></td>
                        <td className="px-3 py-2"><Amount value={it.qty * it.costPrice} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-500 block text-xs">Sub total</span><Amount value={viewing.subTotal} /></div>
              <div><span className="text-gray-500 block text-xs">Discount</span><Amount value={viewing.discountAmount} /></div>
              <div><span className="text-gray-500 block text-xs">Tax</span><Amount value={viewing.taxAmount} /></div>
              <div><span className="text-gray-500 block text-xs">Total</span><Amount value={viewing.totalAmount} /></div>
            </div>

            {viewing.imageUrl && (
              <div className="mt-4">
                <span className="label">Bill image</span>
                <img src={viewing.imageUrl} alt="Invoice" className="rounded-lg border max-w-full" style={{ borderColor: '#E4E7F1' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(30,42,94,0.4)' }}>
          <div className="card p-5 sm:p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">Edit Purchase Invoice</h3>
              <button className="btn btn-sm" onClick={closeEdit}><X size={14} /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Vendor name</label>
                <input className="input" value={editFields.vendorName}
                  onChange={e => setEditFields({ ...editFields, vendorName: e.target.value })} />
              </div>
              <div>
                <label className="label">Invoice number</label>
                <input className="input" value={editFields.invoiceNumber}
                  onChange={e => setEditFields({ ...editFields, invoiceNumber: e.target.value })} />
              </div>
              <div>
                <label className="label">GST number</label>
                <input className="input" value={editFields.vendorGSTIN}
                  onChange={e => setEditFields({ ...editFields, vendorGSTIN: e.target.value })} />
              </div>
              <div>
                <label className="label">Vendor phone</label>
                <input className="input" value={editFields.vendorPhone}
                  onChange={e => setEditFields({ ...editFields, vendorPhone: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Vendor address</label>
                <input className="input" value={editFields.vendorAddress}
                  onChange={e => setEditFields({ ...editFields, vendorAddress: e.target.value })} />
              </div>
            </div>

            <div className="card overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr style={{ background: '#F7F8FB', borderBottom: '1px solid #E4E7F1' }}>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Cost</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editItems.map((it, i) => (
                      <tr key={it.productId + i} style={{ borderBottom: '1px solid #F0F1F8' }}>
                        <td className="px-3 py-2">{it.name}</td>
                        <td className="px-3 py-2">
                          <input className="input py-1.5 w-20" type="number" value={it.qty}
                            onChange={e => updateEditItem(i, { qty: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td className="px-3 py-2">
                          <input className="input py-1.5 w-24" type="number" value={it.costPrice}
                            onChange={e => updateEditItem(i, { costPrice: parseFloat(e.target.value) || 0 })} />
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
            <p className="text-xs text-gray-400 mb-4">Naya item add karna ho to Purchase page se naya invoice banao. Yaha existing items ki qty/cost edit ya remove kar sakte ho.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
              <div>
                <label className="label">Items total (calculated)</label>
                <div className="input py-1.5 bg-gray-50 flex items-center"><Amount value={editSubTotal} /></div>
              </div>
              <div>
                <label className="label">Discount / Less</label>
                <input className="input" type="number" value={editFields.discountAmount}
                  onChange={e => setEditFields({ ...editFields, discountAmount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Tax / GST amount</label>
                <input className="input" type="number" value={editFields.taxAmount}
                  onChange={e => setEditFields({ ...editFields, taxAmount: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="mb-5">
              <label className="label">Actual bill amount (final, editable)</label>
              <input className="input font-medium" type="number" value={editFields.totalAmount}
                onChange={e => setEditFields({ ...editFields, totalAmount: parseFloat(e.target.value) || 0 })} />
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
          title="Purchase invoice delete karein?"
          message="Yeh invoice permanently delete ho jayega."
          revertLabel="Is invoice se jo stock add hua tha, wo bhi wapas minus kar do (recommended)"
          busy={busyDelete}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteOne}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmDeleteModal
          title={`${selected.size} invoices delete karein?`}
          message="Selected invoices permanently delete ho jayenge."
          revertLabel="In invoices se jo stock add hua tha, wo bhi wapas minus kar do (recommended)"
          busy={busyDelete}
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={confirmDeleteBulk}
        />
      )}
    </div>
  )
}
