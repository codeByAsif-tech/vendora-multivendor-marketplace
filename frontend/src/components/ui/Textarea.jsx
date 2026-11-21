import { useId } from 'react'
import { controlClasses } from './controlClasses'
import Field from './Field'

export default function Textarea({ label, error, hint, className, id, ref, rows = 4, ...props }) {
  const generatedId = useId()
  const textareaId = id || generatedId

  return (
    <Field id={textareaId} label={label} error={error} hint={hint} className={className}>
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={`${controlClasses(error)} py-2.5`}
        {...props}
      />
    </Field>
  )
}
