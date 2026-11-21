import { Check } from 'lucide-react'
import Logo from '@/components/common/Logo'
import ThemeToggle from '@/components/common/ThemeToggle'
import { cn } from '@/utils/cn'

// Each portal's welcome panel: a photo under an ink scrim, with white text.
const panels = {
  // Photos: Unsplash (free licence). Ink background shows if a photo fails to load.
  customer: {
    className: 'keep-colors bg-slate-900 bg-cover bg-center',
    dark: true,
    // Shopper carrying a paper bag
    image: 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=1400&q=80',
  },
  seller: {
    className: 'keep-colors bg-slate-900 bg-cover bg-center',
    dark: true,
    // Shop owner serving a customer at the counter
    image: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=1400&q=80',
  },
  admin: {
    className: 'keep-colors bg-slate-900 bg-cover bg-center',
    dark: true,
    // Laptop showing a sales dashboard (Unsplash, free licence)
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=80',
  },
}

const taglines = { seller: 'Seller Hub', admin: 'Admin Console' }

/** Split-screen auth page: welcome panel on the left (desktop), form on the right. */
export default function AuthLayout({ portal = 'customer', heading, subheading, highlights = [], children }) {
  const panel = panels[portal]

  return (
    <div className="storefront grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div
        className={cn('relative hidden flex-col p-12 lg:flex', panel.className)}
        style={panel.image ? { backgroundImage: `url(${panel.image})` } : undefined}
      >
        {panel.image && (
          // Ink scrim: darkest at the top (logo) and bottom (heading) so the text stays readable
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(30,30,36,0.8) 0%, rgba(30,30,36,0.45) 40%, rgba(30,30,36,0.92) 100%)' }}
            aria-hidden="true"
          />
        )}
        <Logo inverted={panel.dark} tagline={taglines[portal]} className="relative" />

        <div className="relative mt-auto max-w-md">
          <h2 className={cn('text-4xl leading-tight', panel.dark ? 'text-white' : 'text-slate-900')}>{heading}</h2>
          {subheading && <p className={cn('mt-4 text-lg', panel.dark ? 'text-slate-300' : 'text-slate-600')}>{subheading}</p>}
          {highlights.length > 0 && (
            <ul className="mt-8 space-y-3">
              {highlights.map((item) => (
                <li key={item} className={cn('flex items-center gap-3', panel.dark ? 'text-slate-200' : 'text-slate-700')}>
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full',
                      panel.dark ? 'bg-white/10 text-brand-300' : 'bg-white text-brand-600',
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className={cn('relative mt-12 text-sm', panel.dark ? 'text-slate-400' : 'text-slate-500')}>
          Trusted by independent sellers across India.
        </p>
      </div>

      <div className="relative flex flex-col justify-center bg-white px-4 py-10 sm:px-12">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
