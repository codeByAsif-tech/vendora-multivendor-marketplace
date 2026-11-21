/** Label + error/hint wrapper shared by Select and Textarea. */
export default function Field({ id, label, error, hint, className, children }) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : 'space-y-1.5'}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
