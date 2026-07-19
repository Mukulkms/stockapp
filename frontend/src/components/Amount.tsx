import { formatINR } from '../lib/helpers'

export default function Amount({ value, size = 'base' }: { value: number; size?: 'base' | 'lg' }) {
  return (
    <span className={`ledger-amount ${size === 'lg' ? 'ledger-amount--lg' : ''}`}>
      ₹{formatINR(value)}
    </span>
  )
}
