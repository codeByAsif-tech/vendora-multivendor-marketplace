import { Check, Circle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { PASSWORD_RULES } from '@/utils/password'

/** Live list of password rules under a "new password" field; each turns green when met. */
export default function PasswordChecklist({ password = '', className }) {
  return (
    <ul className={cn('grid gap-1 text-xs sm:grid-cols-2', className)} aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        return (
          <li key={rule.id} className={cn('flex items-center gap-1.5', met ? 'text-emerald-700' : 'text-slate-500')}>
            {met ? <Check className="size-3.5 shrink-0" strokeWidth={3} /> : <Circle className="size-3 shrink-0" />}
            <span>
              {rule.label}
              <span className="sr-only">{met ? ' (done)' : ' (missing)'}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
