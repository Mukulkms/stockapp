import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PackageSearch, ScanLine, Receipt, FileStack, X, LogOut } from 'lucide-react'
import { logout } from '../api/endpoints'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/purchase', label: 'Purchase Invoice', icon: ScanLine },
  { to: '/purchase-invoices', label: 'Past Invoices', icon: FileStack },
  { to: '/inventory', label: 'Inventory', icon: PackageSearch },
  { to: '/sales', label: 'Sales / Billing', icon: Receipt },
]

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onClose} />
      )}

      <aside
        className={`w-60 shrink-0 h-screen fixed top-0 left-0 z-50 flex flex-col transition-transform duration-200 ease-out
          md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#1E2A5E' }}
      >
        <div className="px-5 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-display font-bold text-sm"
              style={{ background: '#D9A441', color: '#1E2A5E' }}
            >
              DT
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-sm text-white tracking-tight truncate">
                Deep Trading Co.
              </h1>
              <span
                className="inline-block text-[10px] font-display font-semibold mt-0.5 px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(217,164,65,0.15)', color: '#D9A441' }}
              >
                StockBill
              </span>
            </div>
          </div>
          <button className="md:hidden text-white/70 hover:text-white shrink-0" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-[#B7C1E0] hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon size={17} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          className="mx-3 mb-4 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-[#B7C1E0] hover:bg-white/5 hover:text-white transition-colors"
          onClick={() => { logout(); location.href = '/login' }}
        >
          <LogOut size={17} strokeWidth={2} />
          Logout
        </button>
        <div className="px-5 pb-4 text-[11px]" style={{ color: '#5C6A9C' }}>
          Mukul.dev · v1.0
        </div>
      </aside>
    </>
  )
}