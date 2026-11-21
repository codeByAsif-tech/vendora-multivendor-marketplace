import Button from '@/components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold tracking-wider text-brand-600 uppercase">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-md text-slate-500">
        The page you are looking for does not exist or has moved.
      </p>
      <Button to="/" className="mt-8">
        Back to home
      </Button>
    </div>
  )
}
