import { ImageOff } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Small square image with a placeholder when missing. */
export default function Thumb({ src, alt = '', className }) {
  return (
    <span className={cn('flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50', className)}>
      {src ? <img src={src} alt={alt} className="size-full object-cover" loading="lazy" /> : <ImageOff className="size-4 text-slate-300" />}
    </span>
  )
}
