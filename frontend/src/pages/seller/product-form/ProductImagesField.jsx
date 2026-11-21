import { useRef } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Spinner from '@/components/ui/Spinner'
import { useUploadProductImagesMutation } from '@/features/seller/sellerApi'
import { getErrorMessage } from '@/utils/apiError'
import { cn } from '@/utils/cn'
import { IMAGE_ACCEPT, MAX_IMAGE_MB, validateImageFile } from '@/utils/imageFile'
import { MAX_IMAGES } from './productForm'

/** Uploads images right away and keeps [{ url, publicId }] in the form. First image = cover. */
export default function ProductImagesField({ value = [], onChange, error }) {
  const inputRef = useRef(null)
  const [upload, { isLoading }] = useUploadProductImagesMutation()
  const remaining = MAX_IMAGES - value.length

  async function handleFiles(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    const valid = []
    for (const file of files) {
      const problem = validateImageFile(file)
      if (problem) toast.error(problem)
      else valid.push(file)
    }
    if (valid.length > remaining) toast.error(`You can add ${remaining} more image${remaining === 1 ? '' : 's'}`)
    const batch = valid.slice(0, remaining)
    if (!batch.length) return

    const formData = new FormData()
    batch.forEach((file) => formData.append('images', file))
    try {
      const images = await upload(formData).unwrap()
      onChange([...value, ...images])
    } catch (err) {
      toast.error(getErrorMessage(err, 'Image upload failed'))
    }
  }

  function move(index, direction) {
    const target = index + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function remove(index) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {value.map((image, index) => (
          <div
            key={image.publicId}
            className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          >
            <img src={image.url} alt={`Product image ${index + 1}`} className="size-full object-cover" />
            {index === 0 && (
              <span className="absolute top-2 left-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-white">
                Cover
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-slate-900/70 to-transparent p-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded-md bg-white/90 p-1 text-slate-700 disabled:opacity-40"
                  aria-label="Move left"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === value.length - 1}
                  className="rounded-md bg-white/90 p-1 text-slate-700 disabled:opacity-40"
                  aria-label="Move right"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-md bg-white/90 p-1 text-rose-600"
                aria-label="Remove image"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isLoading}
            className={cn(
              'flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-medium transition',
              error
                ? 'border-rose-300 bg-rose-50/50 text-rose-600'
                : 'border-slate-300 text-slate-500 hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-600',
            )}
          >
            {isLoading ? <Spinner className="size-6 text-brand-600" /> : <ImagePlus className="size-6" />}
            {isLoading ? 'Uploading…' : 'Add images'}
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Up to {MAX_IMAGES} images · JPG, PNG or WebP · max {MAX_IMAGE_MB} MB each. The first image is the cover.
      </p>
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}

      <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} multiple className="hidden" onChange={handleFiles} />
    </div>
  )
}
