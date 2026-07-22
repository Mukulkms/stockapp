import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getGroupsApi, createGroupApi, deleteGroupApi, getProductsApi, updateProductApi, deleteProductApi } from '../api/endpoints'
import { BillingGroup, Product } from '../types'
import Amount from '../components/Amount'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 10

export default function Inventory() {
  const [groups, setGroups] = useState<BillingGroup[]>([])
  const [activeGroup, setActiveGroup] = useState<string>('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  const [editing, setEditing] = useState<Product | null>(null)
  const [editFields, setEditFields] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [deleteGroupTarget, setDeleteGroupTarget] = useState<BillingGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState(false)

  useEffect(() => {
    getGroupsApi().then(gs => {
      setGroups(gs)
      if (gs.length) setActiveGroup(gs[0].id)
    })
  }, [])

  const loadProducts = () => {
    if (!activeGroup) { setProducts([]); setLoading(false); return }
    setLoading(true)
    getProductsApi(activeGroup).then(setProducts).finally(() => setLoading(false))
  }

  useEffect(() => { setPage(1); loadProducts() }, [activeGroup])

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) { toast.error('Group name likho'); return }
    try {
      const g = await createGroupApi(newGroupName.trim())
      setGroups(prev => [...prev, g])
      setActiveGroup(g.id)
      setShowNewGroup(false)
      setNewGroupName('')
      toast.success('Group ban gaya')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Group create nahi hua')
    }
  }

  const confirmDeleteGroup = async () => {
    if (!deleteGroupTarget) return
    setDeletingGroup(true)
    try {
      await deleteGroupApi(deleteGroupTarget.id)
      toast.success('Group delete ho gaya')
      const remaining = groups.filter(g => g.id !== deleteGroupTarget.id)
      setGroups(remaining)
      if (activeGroup === deleteGroupTarget.id) setActiveGroup(remaining[0]?.id || '')
      setDeleteGroupTarget(null)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Group delete nahi hua')
    } finally {
      setDeletingGroup(false)
    }
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setEditFields({
      name: p.name,
      unit: p.unit,
      costPrice: p.costPrice,
      marginPercent: p.marginPercent ?? 0,
      stockQty: p.stockQty
    })
  }
  const closeEdit = () => { setEditing(null); setEditFields({}) }

  const saveEdit = async () => {
    if (!editing) return
    if (!editFields.name?.trim()) { toast.error('Product name khaali nahi ho sakta'); return }
    setSaving(true)
    try {
      const updated = await updateProductApi(editing.id, {
        name: editFields.name.trim(),
        unit: editFields.unit || 'pcs',
        costPrice: Math.max(0, parseFloat(editFields.costPrice) || 0),
        marginPercent: Math.max(0, parseFloat(editFields.marginPercent) || 0),
        marginFlat: null,
        stockQty: Math.max(0, parseFloat(editFields.stockQty) || 0)
      })
      setProducts(prev => prev.map(x => x.id === editing.id ? updated : x))
      toast.success('Product update ho gaya')
      closeEdit()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Update nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteProductApi(deleteTarget.id)
      toast.success('Product delete ho gaya')
      setDeleteTarget(null)
      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id))
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete nahi hua')
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE))
  const pageItems = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-semibold text-2xl mb-1">Inventory</h2>
          <p className="text-sm text-gray-500">Har billing group ki alag stock list</p>
        </div>
        <button className="btn btn-accent" onClick={() => setShowNewGroup(true)}>
          <Plus size={14} /> New group
        </button>
      </div>

      {showNewGroup && (
        <div className="card p-4 mb-6 flex gap-2 items-center" style={{ maxWidth: 360 }}>
          <input
            className="input flex-1"
            placeholder="e.g. Pulse, Toffee, MTR"
            value={newGroupName}
            autoFocus
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
          />
          <button className="btn btn-primary" onClick={handleCreateGroup}><Check size={14} /></button>
          <button className="btn" onClick={() => setShowNewGroup(false)}><X size={14} /></button>
        </div>
      )}

      {/* Group tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGroup(g.id)}
            className="group px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            style={
              activeGroup === g.id
                ? { background: '#1B2540', color: '#fff' }
                : { background: '#fff', color: '#3A4566', border: '1px solid #E2E5ED' }
            }
          >
            {g.name} <span className="opacity-60">({g._count?.products ?? 0})</span>
            <span
              onClick={e => { e.stopPropagation(); setDeleteGroupTarget(g) }}
              className="opacity-50 hover:opacity-100"
              style={{ lineHeight: 0 }}
            >
              <X size={13} />
            </span>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr style={{ background: '#F5F6FA', borderBottom: '1px solid #E2E5ED' }}>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Product</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Unit</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Cost price</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Margin %</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Selling rate</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Stock</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #EEF0F6' }}>
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3 text-gray-500">{p.unit}</td>
                  <td className="px-5 py-3"><Amount value={p.costPrice} /></td>
                  <td className="px-5 py-3">{p.marginPercent ?? 0}%</td>
                  <td className="px-5 py-3"><Amount value={p.sellingPrice} /></td>
                  <td className="px-5 py-3">
                    <span className="badge" style={{
                      background: p.stockQty <= 5 ? '#FEF2F2' : '#EDFBF6',
                      color: p.stockQty <= 5 ? '#DC2626' : '#0E7C6B'
                    }}>
                      {p.stockQty} {p.unit}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 justify-end">
                      <button className="btn btn-sm" onClick={() => openEdit(p)}><Pencil size={13} /></button>
                      <button className="btn btn-sm" style={{ color: '#DC2626' }} onClick={() => setDeleteTarget(p)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && products.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 text-sm">
                  Is group mein koi product nahi hai. Purchase invoice scan karke add karo.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalItems={products.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(27,37,64,0.4)' }}>
          <div className="card p-5 sm:p-6 w-full max-w-md" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">Edit product</h3>
              <button className="btn btn-sm" onClick={closeEdit}><X size={14} /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="sm:col-span-2">
                <label className="label">Product name</label>
                <input className="input" value={editFields.name}
                  onChange={e => setEditFields({ ...editFields, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Unit</label>
                <input className="input" value={editFields.unit}
                  onChange={e => setEditFields({ ...editFields, unit: e.target.value })} />
              </div>
              <div>
                <label className="label">Stock qty</label>
                <input className="input" type="number" min={0} value={editFields.stockQty}
                  onChange={e => setEditFields({ ...editFields, stockQty: e.target.value })} />
              </div>
              <div>
                <label className="label">Cost price</label>
                <input className="input" type="number" min={0} value={editFields.costPrice}
                  onChange={e => setEditFields({ ...editFields, costPrice: e.target.value })} />
              </div>
              <div>
                <label className="label">Margin %</label>
                <input className="input" type="number" min={0} value={editFields.marginPercent}
                  onChange={e => setEditFields({ ...editFields, marginPercent: e.target.value })} />
              </div>
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

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(27,37,64,0.4)' }}>
          <div className="card p-5 w-full max-w-sm" style={{ background: '#fff' }}>
            <h3 className="font-display font-semibold text-base mb-2">Product delete karein?</h3>
            <p className="text-sm text-gray-500 mb-5">
              "{deleteTarget.name}" permanently delete ho jayega. Agar yeh product kisi purchase/sales invoice mein use ho chuka hai to delete fail hoga.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button
                className="btn"
                style={{ borderColor: '#DC2626', color: '#fff', background: '#DC2626' }}
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete group confirm */}
      {deleteGroupTarget && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(27,37,64,0.4)' }}>
          <div className="card p-5 w-full max-w-sm" style={{ background: '#fff' }}>
            <h3 className="font-display font-semibold text-base mb-2">Group delete karein?</h3>
            <p className="text-sm text-gray-500 mb-5">
              "{deleteGroupTarget.name}" permanently delete ho jayega. Agar isme products hain to delete fail hoga — pehle unhe hatana/move karna hoga.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={() => setDeleteGroupTarget(null)} disabled={deletingGroup}>Cancel</button>
              <button
                className="btn"
                style={{ borderColor: '#DC2626', color: '#fff', background: '#DC2626' }}
                onClick={confirmDeleteGroup}
                disabled={deletingGroup}
              >
                {deletingGroup ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
                              }
