import { useEffect, useState, useMemo } from 'react'
import { Plus, Trash2, Pencil, X, Check, Loader2, ChevronDown, ChevronRight, Search, FileSpreadsheet, Landmark } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { getChequesApi, createChequeApi, updateChequeApi, deleteChequeApi, getGroupsApi } from '../api/endpoints'
import { Cheque, BillingGroup } from '../types'
import Amount from '../components/Amount'
import FolderIcon from '../components/FolderIcon'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

const FOLDER_COLORS = ['#4F46E5', '#7C3AED', '#2563EB', '#0EA5E9', '#5B21B6', '#0D9488']
function colorForGroup(groupId: string, allIds: string[]) {
  const idx = allIds.indexOf(groupId)
  return FOLDER_COLORS[idx % FOLDER_COLORS.length]
}

const STATUS_LABEL: Record<string, string> = { pending: 'Pending', cleared: 'Cleared', bounced: 'Bounced' }
const STATUS_COLOR: Record<string, string> = { pending: '#D97706', cleared: '#0D9488', bounced: '#DC2626' }

const emptyForm = { groupId: '', chequeNumber: '', bankName: '', amount: '', chequeDate: new Date().toISOString().split('T')[0], status: 'pending', note: '' }

export default function Cheques() {
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [groups, setGroups] = useState<BillingGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [busyDelete, setBusyDelete] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([getChequesApi(), getGroupsApi()])
      .then(([c, g]) => { setCheques(c); setGroups(g) })
      .catch(() => toast.error('Cheques load nahi hue'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cheques
    return cheques.filter(c =>
      c.chequeNumber.toLowerCase().includes(q) ||
      (c.bankName || '').toLowerCase().includes(q) ||
      (c.group?.name || '').toLowerCase().includes(q)
    )
  }, [cheques, search])

  const folders = useMemo(() => {
    const map = new Map<string, { groupId: string; groupName: string; cheques: Cheque[]; total: number }>()
    for (const c of filtered) {
      const groupId = c.groupId || 'unassigned'
      const groupName = c.group?.name || 'Unassigned'
      const entry = map.get(groupId) || { groupId, groupName, cheques: [], total: 0 }
      entry.cheques.push(c)
      entry.total += c.amount
      map.set(groupId, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filtered])

  const folderIds = useMemo(() => folders.map(f => f.groupId), [folders])

  const toggleFolder = (groupId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  const openAdd = (groupId?: string) => {
    setEditingId(null)
    setForm({ ...emptyForm, groupId: groupId || groups[0]?.id || '' })
    setFormOpen(true)
  }

  const openEdit = (c: Cheque) => {
    setEditingId(c.id)
    setForm({
      groupId: c.groupId,
      chequeNumber: c.chequeNumber,
      bankName: c.bankName || '',
      amount: String(c.amount),
      chequeDate: new Date(c.chequeDate).toISOString().split('T')[0],
      status: c.status,
      note: c.note || ''
    })
    setFormOpen(true)
  }

  const closeForm = () => { setFormOpen(false); setEditingId(null); setForm(emptyForm) }

  const save = async () => {
    if (!form.groupId) { toast.error('Company chuno'); return }
    if (!form.chequeNumber.trim()) { toast.error('Cheque number daalo'); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Sahi amount daalo'); return }
    setSaving(true)
    try {
      const payload = { ...form, amount: Number(form.amount) }
      if (editingId) {
        await updateChequeApi(editingId, payload)
        toast.success('Cheque update ho gaya')
      } else {
        await createChequeApi(payload)
        toast.success('Cheque save ho gaya')
      }
      closeForm()
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusyDelete(true)
    try {
      await deleteChequeApi(deleteTarget)
      toast.success('Cheque delete ho gaya')
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete nahi hua')
    } finally {
      setBusyDelete(false)
    }
  }

  const chequeRows = (list: Cheque[]) =>
    [...list]
      .sort((a, b) => new Date(a.chequeDate).getTime() - new Date(b.chequeDate).getTime())
      .map(c => ({
        Date: new Date(c.chequeDate).toLocaleDateString('en-IN'),
        'Cheque #': c.chequeNumber,
        Bank: c.bankName || '—',
        Status: STATUS_LABEL[c.status] || c.status,
        'Amount (₹)': c.amount,
        Note: c.note || ''
      }))

  const downloadFolderExcel = (folder: { groupName: string; cheques: Cheque[]; total: number }) => {
    const rows = chequeRows(folder.cheques)
    rows.push({ Date: '', 'Cheque #': '', Bank: '', Status: '', 'Amount (₹)': folder.total, Note: '' } as any)
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 24 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, folder.groupName.slice(0, 31) || 'Cheques')
    XLSX.writeFile(wb, `${folder.groupName.replace(/[^a-z0-9]+/gi, '_')}_cheques.xlsx`)
    toast.success('Excel download ho gayi')
  }

  const downloadAllExcel = () => {
    if (folders.length === 0) { toast.error('Koi cheque nahi hai'); return }
    const wb = XLSX.utils.book_new()
    const summaryRows = folders.map(f => ({ Company: f.groupName, 'Cheque Count': f.cheques.length, 'Total (₹)': f.total }))
    summaryRows.push({ Company: 'Grand Total', 'Cheque Count': folders.reduce((s, f) => s + f.cheques.length, 0), 'Total (₹)': folders.reduce((s, f) => s + f.total, 0) })
    const summaryWs = XLSX.utils.json_to_sheet(summaryRows)
    summaryWs['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    folders.forEach(f => {
      const rows = chequeRows(f.cheques)
      rows.push({ Date: '', 'Cheque #': '', Bank: '', Status: '', 'Amount (₹)': f.total, Note: '' } as any)
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 24 }]
      XLSX.utils.book_append_sheet(wb, ws, f.groupName.slice(0, 31) || 'Cheques')
    })

    XLSX.writeFile(wb, `All_Companies_Cheques_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Saari companies ki Excel download ho gayi')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <h2 className="font-display font-semibold text-2xl">Cheques</h2>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={downloadAllExcel}>
            <FileSpreadsheet size={13} /> Sabki Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openAdd()}>
            <Plus size={13} /> Naya cheque
          </button>
        </div>
      </div>
      <p className="text-sm text-haze-500 mb-5">Company/group-wise folders mein har cheque ka record — number, bank, date, status sab kuch</p>

      <div className="relative mb-5" style={{ maxWidth: 380 }}>
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-haze-400" />
        <input
          className="input pl-9"
          placeholder="Cheque #, bank ya company se search karo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-sm text-haze-400">Loading...</div>
      ) : cheques.length === 0 ? (
        <div className="text-sm text-haze-400">Koi cheque save nahi hua abhi. "Naya cheque" se shuru karo.</div>
      ) : folders.length === 0 ? (
        <div className="text-sm text-haze-400">Search se koi cheque nahi mila</div>
      ) : (
        <div className="space-y-4">
          {folders.map(folder => {
            const isOpen = !collapsed.has(folder.groupId)
            const accent = colorForGroup(folder.groupId, folderIds)
            return (
              <div key={folder.groupId} className="card overflow-hidden">
                <div className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 flex-wrap">
                  <button className="flex items-center gap-3 min-w-0 text-left flex-1" onClick={() => toggleFolder(folder.groupId)}>
                    {isOpen ? <ChevronDown size={16} className="text-haze-400 shrink-0" /> : <ChevronRight size={16} className="text-haze-400 shrink-0" />}
                    <FolderIcon color={accent} size={36} open={isOpen} />
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold text-sm truncate">{folder.groupName}</h3>
                      <span className="text-xs text-haze-500">{folder.cheques.length} cheque{folder.cheques.length !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-3 shrink-0">
                    <button className="btn btn-sm" onClick={() => openAdd(folder.groupId)}><Plus size={13} /> Add</button>
                    <button className="btn btn-sm" onClick={() => downloadFolderExcel(folder)}><FileSpreadsheet size={13} /> Excel</button>
                    <div className="text-right">
                      <div className="text-[10px] text-haze-500 uppercase tracking-wide">Total</div>
                      <Amount value={folder.total} />
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #E3DFFA' }}>
                    <div className="px-4 sm:px-5 pt-3">
                      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: `${accent}0F` }}>
                        <Landmark size={16} style={{ color: accent }} />
                        <span className="text-xs font-medium" style={{ color: accent }}>Cheques</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto mt-2">
                      <table className="w-full text-sm min-w-[680px]">
                        <thead>
                          <tr style={{ background: '#F5F3FF', borderBottom: '1px solid #E3DFFA' }}>
                            <th className="text-left px-4 py-2.5 font-medium text-haze-500">Date</th>
                            <th className="text-left px-4 py-2.5 font-medium text-haze-500">Cheque #</th>
                            <th className="text-left px-4 py-2.5 font-medium text-haze-500">Bank</th>
                            <th className="text-left px-4 py-2.5 font-medium text-haze-500">Status</th>
                            <th className="text-left px-4 py-2.5 font-medium text-haze-500">Amount</th>
                            <th className="px-4 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...folder.cheques].sort((a, b) => new Date(b.chequeDate).getTime() - new Date(a.chequeDate).getTime()).map(c => (
                            <tr key={c.id} style={{ borderBottom: '1px solid #EDEAFB' }}>
                              <td className="px-4 py-2">{new Date(c.chequeDate).toLocaleDateString('en-IN')}</td>
                              <td className="px-4 py-2">{c.chequeNumber}</td>
                              <td className="px-4 py-2">{c.bankName || '—'}</td>
                              <td className="px-4 py-2">
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${STATUS_COLOR[c.status] || '#6B7280'}1A`, color: STATUS_COLOR[c.status] || '#6B7280' }}>
                                  {STATUS_LABEL[c.status] || c.status}
                                </span>
                              </td>
                              <td className="px-4 py-2"><Amount value={c.amount} /></td>
                              <td className="px-4 py-2">
                                <div className="flex gap-2">
                                  <button className="btn btn-sm" onClick={() => openEdit(c)}><Pencil size={13} /></button>
                                  <button className="btn btn-sm" style={{ color: '#DC2626' }} onClick={() => setDeleteTarget(c.id)}><Trash2 size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(33,28,77,0.4)' }}>
          <div className="card p-5 sm:p-6 w-full max-w-md" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">{editingId ? 'Cheque edit karo' : 'Naya cheque'}</h3>
              <button className="btn btn-sm" onClick={closeForm}><X size={14} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Company</label>
                <select className="input" value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })}>
                  <option value="">Company chuno</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cheque number</label>
                  <input className="input" value={form.chequeNumber} onChange={e => setForm({ ...form, chequeNumber: e.target.value })} />
                </div>
                <div>
                  <label className="label">Bank name</label>
                  <input className="input" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Amount</label>
                  <input className="input" type="number" min={0} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className="label">Cheque date</label>
                  <input className="input" type="date" value={form.chequeDate} onChange={e => setForm({ ...form, chequeDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="cleared">Cleared</option>
                  <option value="bounced">Bounced</option>
                </select>
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <input className="input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button className="btn" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Cheque delete karein?"
          message="Yeh cheque record permanently delete ho jayega."
          busy={busyDelete}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}
