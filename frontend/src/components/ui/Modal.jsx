import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

/** Accessible modal built on the native <dialog> element (focus trap + Esc handled by the browser). */
/** `loading` shows a thin sliding bar under the header while the content is fetched. */
export default function Modal({ open, onClose, title, description, children, footer, size = 'md', loading = false }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      className={cn(
        'modal-animate m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden rounded-2xl bg-white p-0 shadow-elevated',
        'backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm',
        widths[size],
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          {loading && (
            <div className="relative h-0.5 overflow-hidden bg-brand-100" role="progressbar" aria-label="Loading">
              <div className="loading-bar absolute inset-y-0 left-0 w-1/3 rounded-full bg-brand-600" />
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
