import { useEffect, useState, useMemo } from 'react'
import { Trash2, Pencil, Eye, X, Check, Loader2, Folder, ChevronDown, ChevronRight, Search, FileStack } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getPurchaseInvoicesApi, updatePurchaseInvoiceApi, deletePurchaseInvoiceApi,
  bulkDeletePurchaseInvoicesApi
} from '../api/endpoints'
import { PurchaseInvoice } from '../types'
import Amount from '../components/Amount'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

interface EditItem {
  productId: string
  name: string
  qty: number
  costPrice: number
  groupId?: string
}

// Folder accent cycle — indigo / violet / blue family, assigned consistently per group
const FOLDER_COLORS = ['#4F46E5', '#7C3AED', '#2563EB', '#0EA5E9', '#5B21B6', '#0D9488']
function colorForGroup(groupId: string, allIds: string[]) {
  const idx = allIds.indexOf(groupId)
  return FOLDER_COLORS[idx % FOLDER_COLORS.length]
}

const SHOW_INCREMENT = 8

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
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showCount, setShowCount] = useState<Record<string, number>>({})

  const load = () => {
    setLoading(true)
    getPurchaseInvoicesApi().then(list => setInvoices(list)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter(inv =>
      (inv.vendorName || '').toLowerCase().includes(q) ||
      (inv.invoiceNumber || '').toLowerCase().includes(q) ||
      (inv.vendorGSTIN || '').toLowerCase().includes(q)
    )
  }, [invoices, search])

  // Group invoices folder-wise by the billing group of their items (usually one group per invoice)
  const folders = useMemo(() => {
    const map = new Map<string, { groupId: string; groupName: string; invoices: PurchaseInvoice[]; total: number }>()
    for (const inv of filteredInvoices) {
      const firstItem = inv.items?.[0]
      const groupId = firstItem?.product?.groupId || 'unassigned'
      const groupName = firstItem?.product?.group?.name || 'Unassigned'
      const entry = map.get(groupId) || { groupId, groupName, invoices: [], total: 0 }
      entry.invoices.push(inv)
      entry.total += inv.totalAmount
      map.set(groupId, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filteredInvoices])

  const folderIds = useMemo(() => folders.map(f => f.groupId), [folders])

  const toggleFolder = (groupId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  const toggleAllInFolder = (list: PurchaseInvoice[]) => {
    const ids = list.map(i => i.id)
    const allIn = ids.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      ids.forEach(id => allIn ? next.delete(id) : next.add(id))
      return next
    })
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
      billDate: new Date(inv.billDate).toISOString().split('T')[0],
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <h2 className="font-display font-semibold text-2xl">Purchase Invoices</h2>
        {selected.size > 0 && (
          <button className="btn" style={{ borderColor: '#DC2626', color: '#DC2626' }}
            onClick={() => setBulkDeleteOpen(true)} disabled={busyDelete}>
            {busyDelete ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete selected ({selected.size})
          </button>
        )}
      </div>
      <p className="text-sm text-haze-500 mb-5">Company/group-wise folders mein dekho, edit karo, ya ek saath delete karo</p>

      {/* Search */}
      <div className="relative mb-5" style={{ maxWidth: 380 }}>
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-haze-400" />
        <input
          className="input pl-9"
          placeholder="Vendor, invoice # ya GSTIN se search karo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-sm text-haze-400">Loading...</div>
      ) : invoices.length === 0 ? (
        <div className="text-sm text-haze-400">Koi purchase invoice nahi hai abhi</div>
      ) : folders.length === 0 ? (
        <div className="text-sm text-haze-400">Search se koi invoice nahi mila</div>
      ) : (
        <div className="space-y-4">
          {folders.map(folder => {
            const isOpen = !collapsed.has(folder.groupId)
            const accent = colorForGroup(folder.groupId, folderIds)
            const visibleCount = showCount[folder.groupId] || SHOW_INCREMENT
            const visibleInvoices = folder.invoices.slice(0, visibleCount)
            const allSelectedInFolder = folder.invoices.length > 0 && folder.invoices.every(i => selected.has(i.id))

            return (
              <div key={folder.groupId} className="card overflow-hidden">
                {/* Folder header */}
                <button
                  className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 flex-wrap text-left"
                  onClick={() => toggleFolder(folder.groupId)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <ChevronDown size={16} className="text-haze-400 shrink-0" /> : <ChevronRight size={16} className="text-haze-400 shrink-0" />}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${accent}1A` }}
                    >
                      <Folder size={17} style={{ color: accent }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold text-sm truncate">{folder.groupName}</h3>
                      <span className="text-xs text-haze-500">{folder.invoices.length} invoice{folder.invoices.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-haze-500 uppercase tracking-wide">Total</div>
                      <Amount value={folder.total} />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #E3DFFA' }}>
                    <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5" style={{ background: '#F7F5FE' }}>
                      <input type="checkbox" checked={allSelectedInFolder} onChange={() => toggleAllInFolder(folder.invoices)} />
                      <span className="text-xs text-haze-500">Select all in {folder.groupName}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[720px]">
                        <thead>
                          <tr style={{ background: '#F5F3FF', borderBottom: '1px solid #E3DFFA' }}>
                            <th className="px-4 py-2.5"></th>
                            <th className="text-left px-4 py-2.5 font-medium text-haze-500">Date</th>
                            <th className="text-left px-4 py-2.5 font-medium text-haze-500">Vendor</th>
                            <th className="text-left px-4 py-2.5 font-medium text-haze-500">Invoice #</th>
                            <th className="text-left px-4 py-2.5 font-medium text-haze-500">GSTIN</th>
                            <th className="text-left px-4 py-2.5 font-medium text-haze-500">Items</th>
                            <th className="text-left px-4 py-2.5 font-medium text-haze-500">Total</th>
                            <th className="px-4 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleInvoices.map(inv => (
                            <tr key={inv.id} style={{ borderBottom: '1px solid #EDEAFB' }}>
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
                                  <button className="btn btn-sm" style={{ color: '#DC2626' }} onClick={() => setDeleteTarget(inv.id)}><Trash2 size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {folder.invoices.length > visibleCount && (
                      <div className="px-4 sm:px-5 py-3">
                        <button
                          className="btn btn-sm"
                          onClick={() => setShowCount(prev => ({ ...prev, [folder.groupId]: visibleCount + SHOW_INCREMENT }))}
                        >
                          <FileStack size={13} /> Aur dikhao ({folder.invoices.length - visibleCount} baaki)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* View (read-only) modal */}
      {viewing && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(33,28,77,0.4)' }}>
          <div className="card p-5 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">Invoice details</h3>
              <button className="btn btn-sm" onClick={() => setViewing(null)}><X size={14} /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
              <div><span className="text-haze-500">Vendor: </span>{viewing.vendorName || '—'}</div>
              <div><span className="text-haze-500">Invoice #: </span>{viewing.invoiceNumber || '—'}</div>
              <div><span className="text-haze-500">GSTIN: </span>{viewing.vendorGSTIN || '—'}</div>
              <div><span className="text-haze-500">Phone: </span>{viewing.vendorPhone || '—'}</div>
              <div className="sm:col-span-2"><span className="text-haze-500">Address: </span>{viewing.vendorAddress || '—'}</div>
              <div><span className="text-haze-500">Date: </span>{new Date(viewing.billDate).toLocaleDateString('en-IN')}</div>
            </div>

            <div className="card overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr style={{ background: '#F5F3FF', borderBottom: '1px solid #E3DFFA' }}>
                      <th className="text-left px-3 py-2 font-medium text-haze-500">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-haze-500">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-haze-500">Cost</th>
                      <th className="text-left px-3 py-2 font-medium text-haze-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.items.map(it => (
                      <tr key={it.id} style={{ borderBottom: '1px solid #EDEAFB' }}>
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
              <div><span className="text-haze-500 block text-xs">Sub total</span><Amount value={viewing.subTotal} /></div>
              <div><span className="text-haze-500 block text-xs">Discount</span><Amount value={viewing.discountAmount} /></div>
              <div><span className="text-haze-500 block text-xs">Tax</span><Amount value={viewing.taxAmount} /></div>
              <div><span className="text-haze-500 block text-xs">Total</span><Amount value={viewing.totalAmount} /></div>
            </div>

            {viewing.imageUrl && (
              <div className="mt-4">
                <span className="label">Bill image</span>
                <img src={viewing.imageUrl} alt="Invoice" className="rounded-lg border max-w-full" style={{ borderColor: '#E3DFFA' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(33,28,77,0.4)' }}>
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
                <label className="label">Bill date</label>
                <input className="input" type="date" value={editFields.billDate}
                  onChange={e => setEditFields({ ...editFields, billDate: e.target.value })} />
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
                    <tr style={{ background: '#F5F3FF', borderBottom: '1px solid #E3DFFA' }}>
                      <th className="text-left px-3 py-2 font-medium text-haze-500">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-haze-500">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-haze-500">Cost</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editItems.map((it, i) => (
                      <tr key={it.productId + i} style={{ borderBottom: '1px solid #EDEAFB' }}>
                        <td className="px-3 py-2">{it.name}</td>
                        <td className="px-3 py-2">
                          <input className="input py-1.5 w-20" type="number" min={0} value={it.qty}
                            onChange={e => updateEditItem(i, { qty: Math.max(0, parseFloat(e.target.value) || 0) })} />
                        </td>
                        <td className="px-3 py-2">
                          <input className="input py-1.5 w-24" type="number" min={0} value={it.costPrice}
                            onChange={e => updateEditItem(i, { costPrice: Math.max(0, parseFloat(e.target.value) || 0) })} />
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
            <p className="text-xs text-haze-400 mb-4">Naya item add karna ho to Purchase page se naya invoice banao. Yaha existing items ki qty/cost edit ya remove kar sakte ho.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
              <div>
                <label className="label">Items total (calculated)</label>
                <div className="input py-1.5 bg-haze-50 flex items-center"><Amount value={editSubTotal} /></div>
              </div>
              <div>
                <label className="label">Discount / Less</label>
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
              <label className="label">Actual bill amount (final, editable)</label>
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
