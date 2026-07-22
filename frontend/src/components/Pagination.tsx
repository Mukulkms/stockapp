import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalItems, pageSize, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalPages <= 1) return null

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ borderTop: '1px solid #E2E5ED' }}>
      <span className="text-xs text-gray-500">{from}–{to} of {totalItems}</span>
      <div className="flex items-center gap-1">
        <button
          className="btn btn-sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft size={13} />
        </button>
        <span className="text-xs text-gray-500 px-2">Page {page} / {totalPages}</span>
        <button
          className="btn btn-sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
