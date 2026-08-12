import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, Trash2, Check, Loader2, ImagePlus, X, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProductsApi, createSalesInvoiceApi } from '../api/endpoints'
import { Product } from '../types'
import Amount from '../components/Amount'
import { generateSalesInvoicePDF } from '../lib/pdf'

interface DraftLine {
  productId: string
  qty: number
  rate: number
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export default function Sales() {
  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', qty: 1, rate: 0 }])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerGSTIN, setCustomerGSTIN] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [totalAmount, setTotalAmount] = useState<number | ''>('')
  const [totalTouched, setTotalTouched] = useState(false)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { getProductsApi().then(setProducts) }, [])

  const subTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (l.qty || 0) * (l.rate || 0), 0),
    [lines]
  )
  const computedTotal = +(subTotal - (discountAmount || 0) + (taxAmount || 0)).toFixed(2)

  const addLine = () => setLines(prev => [...prev, { productId: '', qty: 1, rate: 0 }])
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))

  const updateLine = (i: number, patch: Partial<DraftLine>) => {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const next = { ...l, ...patch }
      if (patch.productId) {
        const p = products.find(p => p.id === patch.productId)
        if (p) next.rate = p.sellingPrice
      }
      return next
    }))
  }

  const stockFor = (productId: string) => products.find(p => p.id === productId)?.stockQty

  const handleImagePick = async (file: File) => {
    try {
      const dataUrl = await fileToDataUrl(file)
      setImageDataUrl(dataUrl)
    } catch {
      toast.error('Image load nahi hui')
    }
  }

  const resetForm = () => {
    setLines([{ productId: '', qty: 1, rate: 0 }])
    setCustomerName(''); setCustomerPhone(''); setCustomerGSTIN(''); setCustomerAddress('')
    setInvoiceNumber(''); setDiscountAmount(0); setTaxAmount(0); setTotalAmount(''); setTotalTouched(false)
    setImageDataUrl(null)
  }

  const save = async (downloadPdf: boolean) => {
    const validLines = lines.filter(l => l.productId && l.qty > 0)
    if (!validLines.length) { toast.error('Kam se kam ek product select karo'); return }

    for (const l of validLines) {
      const stock = stockFor(l.productId)
      if (stock !== undefined && l.qty > stock) {
        const p = products.find(p => p.id === l.productId)
        toast.error(`${p?.name}: sirf ${stock} ${p?.unit} stock me hai`)
        return
      }
    }

    setSaving(true)
    try {
      const invoice = await createSalesInvoiceApi({
        invoiceNumber, customerName, customerPhone, customerGSTIN, customerAddress,
        imageUrl: imageDataUrl || undefined,
        discountAmount: discountAmount || 0,
        taxAmount: taxAmount || 0,
        totalAmount: totalTouched && totalAmount !== '' ? totalAmount : undefined,
        items: validLines.map(l => ({ productId: l.productId, qty: l.qty, rate: l.rate }))
      })
      toast.success('Bill save ho gaya, stock update ho gaya ✓')
      if (downloadPdf) await generateSalesInvoicePDF(invoice)
      resetForm()
      getProductsApi().then(setProducts) // refresh stock numbers
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <h2 className="font-display font-semibold text-2xl mb-1">New Sale / Billing</h2>
      <p className="text-sm text-gray-500 mb-6">Product select karo, bill banao, PDF download karo — stock auto-kam ho jayega</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="label">Customer name</label>
          <input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="label">Invoice number</label>
          <input className="input" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
            placeholder="Auto-generate hoga agar khali chhoda" />
        </div>
        <div>
          <label className="label">Customer phone</label>
          <input className="input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
        </div>
        <div>
          <label className="label">Customer GST (optional)</label>
          <input className="input" value={customerGSTIN} onChange={e => setCustomerGSTIN(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Customer address</label>
          <input className="input" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr style={{ background: 'rgba(245,246,250,0.6)', borderBottom: '1px solid rgba(226,229,237,0.7)' }}>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Product</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Stock</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Qty</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Rate</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Amount</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const p = products.find(p => p.id === l.productId)
                const amount = +((l.qty || 0) * (l.rate || 0)).toFixed(2)
                const overStock = p && l.qty > p.stockQty
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(238,240,246,0.7)' }}>
                    <td className="px-4 py-2">
                      <select className="input py-1.5" value={l.productId}
                        onChange={e => updateLine(i, { productId: e.target.value })}>
                        <option value="">Select product...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.group?.name})</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-xs" style={{ color: overStock ? '#DC2626' : '#64748B' }}>
                      {p ? `${p.stockQty} ${p.unit}` : '-'}
                    </td>
                    <td className="px-4 py-2">
                      <input className="input py-1.5 w-20" type="number" min={0} value={l.qty}
                        onChange={e => updateLine(i, { qty: Math.max(0, parseFloat(e.target.value) || 0) })}
                        style={overStock ? { borderColor: '#DC2626' } : undefined} />
                    </td>
                    <td className="px-4 py-2">
                      <input className="input py-1.5 w-24" type="number" min={0} value={l.rate}
                        onChange={e => updateLine(i, { rate: Math.max(0, parseFloat(e.target.value) || 0) })} />
                    </td>
                    <td className="px-4 py-2"><Amount value={amount} /></td>
                    <td className="px-4 py-2">
                      <button className="btn btn-sm" onClick={() => removeLine(i)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3">
          <button className="btn btn-sm" onClick={addLine}><Plus size={13} /> Add item</button>
        </div>
      </div>

      <div className="card p-4 sm:p-5 mb-4">
        <h3 className="font-medium text-sm mb-3" style={{ color: '#1B2540' }}>Bill amount</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
          <div>
            <label className="label">Items total (calculated)</label>
            <div className="input py-1.5 flex items-center"><Amount value={subTotal} /></div>
          </div>
          <div>
            <label className="label">Discount</label>
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
          <label className="label">Final bill amount (editable)</label>
          <input className="input font-medium" type="number" min={0}
            value={totalTouched ? totalAmount : computedTotal}
            onChange={e => { setTotalAmount(Math.max(0, parseFloat(e.target.value) || 0)); setTotalTouched(true) }} />
        </div>
      </div>

      <div className="card p-4 sm:p-5 mb-6">
        <h3 className="font-medium text-sm mb-3" style={{ color: '#1B2540' }}>Original bill photo (optional)</h3>
        {imageDataUrl ? (
          <div className="relative inline-block">
            <img src={imageDataUrl} alt="bill" className="h-28 rounded-lg border" style={{ borderColor: '#E2E5ED' }} />
            <button className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow" onClick={() => setImageDataUrl(null)}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <button className="btn justify-center py-3 px-4" style={{ borderStyle: 'dashed' }} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={16} /> Attach handwritten bill photo
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleImagePick(e.target.files[0]); e.target.value = '' }} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button className="btn btn-primary" onClick={() => save(false)} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Save bill
        </button>
        <button className="btn btn-accent" onClick={() => save(true)} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
          Save & download PDF
        </button>
      </div>
    </div>
  )
}
