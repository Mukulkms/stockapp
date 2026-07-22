import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'

interface Props {
  title: string
  message: string
  revertLabel: string
  busy?: boolean
  onCancel: () => void
  onConfirm: (revertStock: boolean) => void
}

export default function ConfirmDeleteModal({ title, message, revertLabel, busy, onCancel, onConfirm }: Props) {
  const [revertStock, setRevertStock] = useState(true)

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(27,37,64,0.4)' }}>
      <div className="card p-5 w-full max-w-sm" style={{ background: '#fff' }}>
        <h3 className="font-display font-semibold text-base mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-4">{message}</p>

        <label className="flex items-start gap-2 text-sm mb-5 p-3 rounded-lg" style={{ background: '#F8F9FC', border: '1px solid #E2E5ED' }}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={revertStock}
            onChange={e => setRevertStock(e.target.checked)}
          />
          <span>{revertLabel}</span>
        </label>

        <div className="flex gap-2 justify-end">
          <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="btn"
            style={{ borderColor: '#DC2626', color: '#fff', background: '#DC2626' }}
            onClick={() => onConfirm(revertStock)}
            disabled={busy}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
