/** Shared look for text-like form controls (select, textarea, small inputs). */
export function controlClasses(error) {
  return [
    'block w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm transition',
    'placeholder:text-slate-400 focus:outline-none focus:ring-4 disabled:bg-slate-50 disabled:text-slate-500',
    error
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100',
  ].join(' ')
}
