import { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Uncontrolled search box that calls onSearch after the user stops typing. */
export default function SearchInput({ onSearch, placeholder = 'Search…', defaultValue = '', delay = 350, className }) {
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  function handleChange(event) {
    const value = event.target.value
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onSearch(value.trim()), delay)
  }

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        defaultValue={defaultValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
      />
    </div>
  )
}
