import { useEffect, useMemo, useState } from 'react'
import { Package, ShoppingCart, AlertTriangle, ScanLine } from 'lucide-react'
import { getProductsApi, getPurchaseInvoicesApi } from '../api/endpoints'
import { Product, PurchaseInvoice } from '../types'
import Amount from '../components/Amount'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 10

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    Promise.all([getProductsApi(), getPurchaseInvoicesApi()])
      .then(([p, pu]) => { setProducts(p); setPurchases(pu) })
      .finally(() => setLoading(false))
  }, [])

  const stockValue = products.reduce((sum, p) => sum + p.stockQty * p.costPrice, 0)
  const lowStock = products.filter(p => p.stockQty <= 5)

  const stats = [
    { label: 'Stock value (cost)', value: stockValue, icon: Package, isAmount: true },
    { label: 'Purchase invoices', value: purchases.length, icon: ScanLine, isAmount: false },
    { label: 'Total products', value: products.length, icon: ShoppingCart, isAmount: false },
    { label: 'Low stock items', value: lowStock.length, icon: AlertTriangle, isAmount: false, alert: lowStock.length > 0 },
  ]

  const groupBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; count: number; totalQty: number; value: number }>()
    for (const p of products) {
      const key = p.groupId || 'ungrouped'
      const name = p.group?.name || 'Ungrouped'
      const entry = map.get(key) || { name, count: 0, totalQty: 0, value: 0 }
      entry.count += 1
      entry.totalQty += p.stockQty
      entry.value += p.stockQty * p.costPrice
      map.set(key, entry)
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.value - a.value)
  }, [products])

  const filteredProducts = useMemo(() => {
    if (activeGroupFilter === 'all') return products
    return products.filter(p => p.groupId === activeGroupFilter)
  }, [products, activeGroupFilter])

  useEffect(() => { setPage(1) }, [activeGroupFilter])

  const pageItems = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <h2 className="font-display font-semibold text-2xl mb-1">Dashboard</h2>
      <p className="text-sm text-gray-500 mb-6">Aaj ka overview</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="card p-4 sm:p-5 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <span className="label mb-0 truncate">{s.label}</span>
              <s.icon size={16} className={`shrink-0 ${s.alert ? 'text-danger' : 'text-mustard'}`} />
            </div>
            {s.isAmount ? (
              <Amount value={s.value as number} size="lg" />
            ) : (
              <span className={`font-display font-bold text-2xl ${s.alert ? 'text-danger' : ''}`}>
                {loading ? '—' : s.value}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="card p-4 sm:p-5 mb-8">
        <h3 className="font-display font-semibold text-sm mb-4">Stock by group</h3>
        {groupBreakdown.length === 0 ? (
          <p className="text-xs text-gray-400">{loading ? 'Loading...' : 'Koi group/product nahi hai abhi.'}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groupBreakdown.map(g => (
              <button
                key={g.id}
                onClick={() => setActiveGroupFilter(activeGroupFilter === g.id ? 'all' : g.id)}
                className="text-left p-4 rounded-lg border transition-colors"
                style={
                  activeGroupFilter === g.id
                    ? { background: '#1E2A5E', borderColor: '#1E2A5E', color: '#fff' }
                    : { background: '#FAFBFF', borderColor: '#E4E7F1', color: '#1E2A5E' }
                }
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm truncate">{g.name}</span>
                  <span className="text-xs opacity-70 shrink-0">{g.count} items</span>
                </div>
                <div className="flex items-center justify-between text-xs opacity-80">
                  <span>{g.totalQty} units in stock</span>
                  <span>₹{g.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-hidden mb-8">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 flex-wrap gap-2" style={{ borderBottom: '1px solid #E4E7F1' }}>
          <h3 className="font-display font-semibold text-sm">
            Item-wise stock {activeGroupFilter !== 'all' && `— ${groupBreakdown.find(g => g.id === activeGroupFilter)?.name}`}
          </h3>
          {activeGroupFilter !== 'all' && (
            <button className="btn btn-sm" onClick={() => setActiveGroupFilter('all')}>Show all</button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr style={{ background: '#F7F8FB', borderBottom: '1px solid #E4E7F1' }}>
                <th className="text-left px-4 sm:px-5 py-2.5 font-medium text-gray-500">Product</th>
                <th className="text-left px-4 sm:px-5 py-2.5 font-medium text-gray-500">Group</th>
                <th className="text-left px-4 sm:px-5 py-2.5 font-medium text-gray-500">Unit</th>
                <th className="text-left px-4 sm:px-5 py-2.5 font-medium text-gray-500">Stock</th>
                <th className="text-left px-4 sm:px-5 py-2.5 font-medium text-gray-500">Value</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F0F1F8' }}>
                  <td className="px-4 sm:px-5 py-2.5 font-medium">{p.name}</td>
                  <td className="px-4 sm:px-5 py-2.5 text-gray-500">{p.group?.name || '—'}</td>
                  <td className="px-4 sm:px-5 py-2.5 text-gray-500">{p.unit}</td>
                  <td className="px-4 sm:px-5 py-2.5">
                    <span className="badge" style={{
                      background: p.stockQty <= 5 ? '#FEF2F2' : '#F0FDF4',
                      color: p.stockQty <= 5 ? '#DC2626' : '#0F9D58'
                    }}>
                      {p.stockQty} {p.unit}
                    </span>
                  </td>
                  <td className="px-4 sm:px-5 py-2.5"><Amount value={p.stockQty * p.costPrice} /></td>
                </tr>
              ))}
              {!loading && filteredProducts.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">
                  Koi product nahi mila.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalItems={filteredProducts.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-sm mb-4">Recent purchases</h3>
          <div className="space-y-3">
            {purchases.slice(0, 6).map(inv => (
              <div key={inv.id} className="flex items-center justify-between text-sm pb-3 gap-3" style={{ borderBottom: '1px solid #F0F1F8' }}>
                <div className="min-w-0">
                  <p className="font-medium truncate">{inv.vendorName || 'Unknown vendor'}</p>
                  <p className="text-xs text-gray-500 truncate">{inv.invoiceNumber || '—'} · {inv.billDate.split('T')[0]}</p>
                </div>
                <Amount value={inv.totalAmount} />
              </div>
            ))}
            {purchases.length === 0 && <p className="text-xs text-gray-400">Koi purchase invoice nahi bana abhi tak.</p>}
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-sm mb-4">Low stock alert</h3>
          <div className="space-y-3">
            {lowStock.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm pb-3 gap-3" style={{ borderBottom: '1px solid #F0F1F8' }}>
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-gray-500 truncate">{p.group?.name}</p>
                </div>
                <span className="badge shrink-0" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  {p.stockQty} {p.unit} left
                </span>
              </div>
            ))}
            {lowStock.length === 0 && <p className="text-xs text-gray-400">Sab products ka stock theek hai ✓</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
