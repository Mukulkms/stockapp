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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F5F6FA' }}>
      <div className="card p-6 sm:p-8 w-full max-w-sm" style={{ background: '#fff' }}>
        <div className="text-center mb-6">
          <h1 className="font-display font-bold text-xl tracking-tight" style={{ color: '#1E2A5E' }}>
            Stock<span style={{ color: '#D9A441' }}>Bill</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">trade ledger, digitized</p>
        </div>

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
    </div>
  )
}