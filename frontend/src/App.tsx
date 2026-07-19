import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Menu, LogOut } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Purchase from './pages/Purchase'
import PurchaseInvoicesList from './pages/PurchaseInvoicesList'
import Sales from './pages/Sales'
import Login from './pages/login'
import { isLoggedIn, logout } from './api/endpoints'

function RequireAuth({ children }: { children: JSX.Element }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return children
}

function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen" style={{ background: '#F7F8FB' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b"
        style={{ background: '#1E2A5E', borderColor: '#2A386E' }}>
        <div className="flex items-center gap-3">
          <button className="text-white/80 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <h1 className="font-display font-bold text-base text-white tracking-tight">
            Stock<span style={{ color: '#D9A441' }}>Bill</span>
          </h1>
        </div>
        <button className="text-white/80 hover:text-white" onClick={() => { logout(); location.href = '/login' }}>
          <LogOut size={18} />
        </button>
      </div>

      <main className="md:ml-60 min-w-0">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/purchase" element={<Purchase />} />
          <Route path="/purchase-invoices" element={<PurchaseInvoicesList />} />
          <Route path="/sales" element={<Sales />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      />
    </Routes>
  )
}