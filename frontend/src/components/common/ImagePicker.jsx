import { useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { IMAGE_ACCEPT, MAX_IMAGE_MB, validateImageFile } from '@/utils/imageFile'

/**
 * Single image picker with preview. Calls onSelect(file) after a client-side check.
 * shape: 'square' (logos, categories) | 'wide' (banners)
 */
export default function ImagePicker({
  label,
  imageUrl,
  onSelect,
  loading = false,
  disabled = false,
  shape = 'square',
  hint = `JPG, PNG or WebP, up to ${MAX_IMAGE_MB} MB`,
}) {
  const inputRef = useRef(null)

  function handleChange(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow choosing the same file again
    if (!file) return
    const error = validateImageFile(file)
    if (error) {
      toast.error(error)
      return
    }
    onSelect(file)
  }

  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>}
      <div className={cn('flex gap-4', shape === 'wide' ? 'flex-col' : 'items-center')}>
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-slate-300 bg-slate-50',
            shape === 'wide' ? 'aspect-[4/1] w-full rounded-xl' : 'size-24 rounded-2xl',
          )}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-7 text-slate-400" />
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-brand-600">
              <Spinner className="size-6" />
            </div>
          )}
        </div>
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || loading}
            onClick={() => inputRef.current?.click()}
          >
            {imageUrl ? 'Change image' : 'Upload image'}
          </Button>
          <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={handleChange} />
    </div>
  )
}
