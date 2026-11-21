import Spinner from '@/components/ui/Spinner'

export default function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-brand-600">
      <Spinner className="size-8" />
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  )
}
