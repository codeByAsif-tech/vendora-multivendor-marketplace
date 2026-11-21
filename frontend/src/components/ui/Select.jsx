import { useId } from 'react'
import { controlClasses } from './controlClasses'
import Field from './Field'

/**
 * <Select label="Type" options={[{ value, label }]} placeholder="Choose…" {...register('type')} />
 * Pass children (<option>/<optgroup>) instead of `options` for grouped lists.
 */
export default function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  className,
  id,
  ref,
  children,
  ...props
}) {
  const generatedId = useId()
  const selectId = id || generatedId

  return (
    <Field id={selectId} label={label} error={error} hint={hint} className={className}>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={Boolean(error)}
        className={`${controlClasses(error)} h-11 pr-8`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children ??
          options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>
    </Field>
  )
}
