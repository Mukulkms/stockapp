import { useState, useRef, useEffect, useMemo } from 'react'
import { Upload, Camera, Loader2, Sparkles, Trash2, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { scanPurchaseInvoiceApi, createPurchaseInvoiceApi, getGroupsApi } from '../api/endpoints'
import { BillingGroup } from '../types'
import Amount from '../components/Amount'
import { todayISO, parseInvoiceDate } from '../lib/helpers'

interface DraftItem {
  name: string
  qty: number
  unit: string
  costPrice: number
  groupId: string
  marginPercent: number
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export default function Purchase() {
  const [groups, setGroups] = useState<BillingGroup[]>([])
  const [scanning, setScanning] = useState(false)
  const [items, setItems] = useState<DraftItem[]>([])
  const [invoiceGroupId, setInvoiceGroupId] = useState('')
  const [billDate, setBillDate] = useState(todayISO())
  const [vendorName, setVendorName] = useState('')
  const [vendorGSTIN, setVendorGSTIN] = useState('')
  const [vendorPhone, setVendorPhone] = useState('')
  const [vendorAddress, setVendorAddress] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [totalAmount, setTotalAmount] = useState<number | ''>('')
  const [totalTouched, setTotalTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  useEffect(() => { getGroupsApi().then(gs => { setGroups(gs); if (gs[0]) setInvoiceGroupId(gs[0].id) }) }, [])

  const subTotal = useMemo(
    () => items.reduce((sum, it) => sum + (it.qty || 0) * (it.costPrice || 0), 0),
    [items]
  )
  const computedTotal = +(subTotal - (discountAmount || 0) + (taxAmount || 0)).toFixed(2)

  const scan = async (file: File) => {
    setScanning(true)
    try {
      const base64 = await fileToBase64(file)
      const data = await scanPurchaseInvoiceApi(base64, file.type || 'image/jpeg')
      setVendorName(data.vendorName || '')
      setVendorGSTIN(data.vendorGSTIN || '')
      setVendorPhone(data.vendorPhone || '')
      setVendorAddress(data.vendorAddress || '')
      setInvoiceNumber(data.invoiceNumber || '')
      const parsedDate = parseInvoiceDate(data.date)
      if (parsedDate) setBillDate(parsedDate)
      setDiscountAmount(data.discountAmount || 0)
      setTaxAmount(data.taxAmount || 0)
      if (data.totalAmount !== undefined && data.totalAmount !== null) {
        setTotalAmount(data.totalAmount)
        setTotalTouched(true)
      } else {
        setTotalAmount('')
        setTotalTouched(false)
      }
      setItems((data.items || []).map((it: any) => ({
        name: it.name || '',
        qty: Math.max(0, it.qty || 1),
        unit: it.unit || 'pcs',
        costPrice: Math.max(0, it.costPrice || 0),
        groupId: invoiceGroupId || groups[0]?.id || '',
        marginPercent: 0
      })))
      toast.success('Invoice padh liya! Review karo neeche.')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Invoice padhne mein dikkat aayi')
    } finally {
      setScanning(false)
    }
  }

  const changeInvoiceGroup = (id: string) => {
    setInvoiceGroupId(id)
    setItems(prev => prev.map(it => ({ ...it, groupId: id })))
  }

  const updateItem = (i: number, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const save = async () => {
    if (!items.length) { toast.error('Koi item nahi hai'); return }
    if (!invoiceGroupId) { toast.error('Company/Group select karo'); return }

    setSaving(true)
    try {
      await createPurchaseInvoiceApi({
        vendorName, vendorGSTIN, vendorPhone, vendorAddress, invoiceNumber, billDate,
        discountAmount: discountAmount || 0,
        taxAmount: taxAmount || 0,
        totalAmount: totalTouched && totalAmount !== '' ? totalAmount : undefined,
        items: items.map(it => ({
          name: it.name, groupId: it.groupId, unit: it.unit,
          qty: it.qty, costPrice: it.costPrice, marginPercent: it.marginPercent
        }))
      })
      toast.success('Purchase invoice save ho gaya, stock update ho gaya ✓')
      setItems([]); setVendorName(''); setVendorGSTIN(''); setVendorPhone(''); setVendorAddress('')
      setInvoiceNumber(''); setDiscountAmount(0); setTaxAmount(0); setTotalAmount(''); setTotalTouched(false); setBillDate(todayISO())
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <h2 className="font-display font-semibold text-2xl mb-1">Purchase Invoice</h2>
      <p className="text-sm text-haze-500 mb-6">Bill scan karo, margin set karo, stock auto-add ho jayega</p>

      <div className="card p-4 sm:p-5 mb-6" style={{ background: '#F7F5FE' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="btn flex-1 justify-center py-3"
            style={{ borderStyle: 'dashed', borderColor: '#211C4D', color: '#211C4D' }}
            onClick={() => fileRef.current?.click()} disabled={scanning}>
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Upload invoice photo
          </button>
          <button className="btn flex-1 justify-center py-3"
            style={{ borderStyle: 'dashed', borderColor: '#4F46E5', color: '#3730A3' }}
            onClick={() => camRef.current?.click()} disabled={scanning}>
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            Camera
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) scan(e.target.files[0]); e.target.value = '' }} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { if (e.target.files?.[0]) scan(e.target.files[0]); e.target.value = '' }} />
        {scanning && (
          <div className="flex items-center gap-2 mt-3 text-sm" style={{ color: '#211C4D' }}>
            <Sparkles size={14} /> AI invoice padh raha hai...
          </div>
        )}
      </div>

      {items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Company / Group (poore invoice ke liye ek hi)</label>
              <select className="input" value={invoiceGroupId} onChange={e => changeInvoiceGroup(e.target.value)}>
                <option value="">Select...</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Vendor name</label>
              <input className="input" value={vendorName} onChange={e => setVendorName(e.target.value)} />
            </div>
            <div>
              <label className="label">Invoice number</label>
              <input className="input" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
            </div>
            <div>
              <label className="label">Bill date (jis date ko ye purchase hui thi)</label>
              <input className="input" type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
            </div>
            <div>
              <label className="label">GST number</label>
              <input className="input" value={vendorGSTIN} onChange={e => setVendorGSTIN(e.target.value)} />
            </div>
            <div>
              <label className="label">Vendor phone</label>
              <input className="input" value={vendorPhone} onChange={e => setVendorPhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Vendor address</label>
              <input className="input" value={vendorAddress} onChange={e => setVendorAddress(e.target.value)} />
            </div>
          </div>

          <div className="card overflow-hidden mb-4">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr style={{ background: '#F5F3FF', borderBottom: '1px solid #E3DFFA' }}>
                  <th className="text-left px-4 py-2.5 font-medium text-haze-500">Product</th>
                  <th className="text-left px-4 py-2.5 font-medium text-haze-500">Qty</th>
                  <th className="text-left px-4 py-2.5 font-medium text-haze-500">Unit</th>
                  <th className="text-left px-4 py-2.5 font-medium text-haze-500">rate per box/case</th>
                  <th className="text-left px-4 py-2.5 font-medium text-haze-500">Amount</th>
                  <th className="text-left px-4 py-2.5 font-medium text-haze-500">Margin %</th>
                  <th className="text-left px-4 py-2.5 font-medium text-haze-500">Rate after margin</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const amount = +((it.qty || 0) * (it.costPrice || 0)).toFixed(2)
                  const rateAfterMargin = +(it.costPrice * (1 + (it.marginPercent || 0) / 100)).toFixed(2)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #EDEAFB' }}>
                      <td className="px-4 py-2">
                        <input className="input py-1.5" value={it.name}
                          onChange={e => updateItem(i, { name: e.target.value })} />
                      </td>
                      <td className="px-4 py-2">
                        <input className="input py-1.5 w-20" type="number" min={0} value={it.qty}
                          onChange={e => updateItem(i, { qty: Math.max(0, parseFloat(e.target.value) || 0) })} />
                      </td>
                      <td className="px-4 py-2">
                        <input className="input py-1.5 w-20" value={it.unit}
                          onChange={e => updateItem(i, { unit: e.target.value })} />
                      </td>
                      <td className="px-4 py-2">
                        <input className="input py-1.5 w-24" type="number" min={0} value={it.costPrice}
                          onChange={e => updateItem(i, { costPrice: Math.max(0, parseFloat(e.target.value) || 0) })} />
                      </td>
                      <td className="px-4 py-2"><Amount value={amount} /></td>
                      <td className="px-4 py-2">
                        <input className="input py-1.5 w-20" type="number" min={0} value={it.marginPercent}
                          onChange={e => updateItem(i, { marginPercent: Math.max(0, parseFloat(e.target.value) || 0) })} />
                      </td>
                      <td className="px-4 py-2"><Amount value={rateAfterMargin} /></td>
                      <td className="px-4 py-2">
                        <button className="btn btn-sm" onClick={() => removeItem(i)}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>

          <div className="card p-4 sm:p-5 mb-4" style={{ background: '#F7F5FE' }}>
            <h3 className="font-medium text-sm mb-3" style={{ color: '#211C4D' }}>Bill amount</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
              <div>
                <label className="label">Items total (calculated)</label>
                <div className="input py-1.5 bg-haze-50 flex items-center"><Amount value={subTotal} /></div>
              </div>
              <div>
                <label className="label">Discount / Less</label>
                <input className="input" type="number" min={0} value={discountAmount}
                  onChange={e => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))} />
              </div>
              <div>
                <label className="label">Tax / GST amount</label>
                <input className="input" type="number" min={0} value={taxAmount}
                  onChange={e => setTaxAmount(Math.max(0, parseFloat(e.target.value) || 0))} />
              </div>
            </div>
            <div>
              <label className="label">Actual bill amount (jo bill pe likha hai — final, editable)</label>
              <input className="input font-medium" type="number" min={0}
                value={totalTouched ? totalAmount : computedTotal}
                onChange={e => { setTotalAmount(Math.max(0, parseFloat(e.target.value) || 0)); setTotalTouched(true) }} />
              <p className="text-xs text-haze-400 mt-1">
                Default calculated = items total − discount + tax. Bill pe jo actual final amount likha hai wahi yahan daalo/edit karo, margin alag se lagega.
              </p>
            </div>
          </div>

          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save & update stock
          </button>
        </>
      )}
    </div>
  )
}