import Card from '@/components/ui/Card'

/** Card with a title on top: used to group long forms into sections. */
export default function FormSection({ title, description, actions, children }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6">{children}</div>
    </Card>
  )
}
