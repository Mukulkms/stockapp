import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import { loginApi } from '../api/endpoints'
import { TOKEN_KEY } from '../api/client'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) { toast.error('Username aur password dono bharo'); return }
    setLoading(true)
    try {
      const { token } = await loginApi(username.trim(), password)
      localStorage.setItem(TOKEN_KEY, token)
      navigate('/', { replace: true })
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Login nahi hua')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#1E2A5E' }}
    >
      {/* subtle background accent */}
      <div
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-10 pointer-events-none"
        style={{ background: '#D9A441' }}
      />
      <div
        className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full opacity-[0.07] pointer-events-none"
        style={{ background: '#D9A441' }}
      />

      <div className="w-full max-w-sm relative">
        {/* Company brand */}
        <div className="text-center mb-7">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center font-display font-bold text-lg"
            style={{ background: '#D9A441', color: '#1E2A5E' }}
          >
            DT
          </div>
          <h1 className="font-display font-bold text-2xl text-white tracking-tight">
            Deep Trading Co.
          </h1>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: '#8291BE' }}>Powered by</span>
            <span
              className="text-[11px] font-display font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(217,164,65,0.15)', color: '#D9A441' }}
            >
              StockBill
            </span>
          </div>
        </div>

        {/* Login card */}
        <div className="card p-6 sm:p-8" style={{ background: '#fff' }}>
          <h2 className="font-display font-semibold text-base mb-5" style={{ color: '#1E2A5E' }}>
            Sign in to your ledger
          </h2>

          <form onSubmit={submit}>
            <div className="mb-4">
              <label className="label">Username</label>
              <input
                className="input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="mb-6">
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button className="btn btn-primary w-full justify-center" disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              Login
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: '#5C6A9C' }}>
          Deep Trading Co. · trade ledger, digitized
        </p>
      </div>
    </div>
  )
}