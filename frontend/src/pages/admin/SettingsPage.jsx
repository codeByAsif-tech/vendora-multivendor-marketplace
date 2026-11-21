import { useState } from 'react'
import { HandCoins, LifeBuoy, Megaphone, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import FormSection from '@/components/common/FormSection'
import PageHeader from '@/components/common/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Skeleton from '@/components/ui/Skeleton'
import Switch from '@/components/ui/Switch'
import { useGetAdminSettingsQuery, useUpdateSettingsMutation } from '@/features/settings/settingsApi'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'
import { formatDateTime } from '@/utils/format'
import { paiseToRupees, RUPEE_PATTERN, rupeesToPaise } from '@/utils/money'

const toForm = (s) => ({
  fee: paiseToRupees(s.shipping.fee),
  freeThreshold: paiseToRupees(s.shipping.freeThreshold),
  firstOrderFree: s.shipping.firstOrderFree,
  message: s.announcement.message,
  email: s.support.email,
  phone: s.support.phone,
})

/** Remounted (key) after each save, so it always starts from the saved values. */
function SettingsForm({ settings }) {
  const [save, { isLoading }] = useUpdateSettingsMutation()
  const [form, setForm] = useState(() => toForm(settings))
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const moneyOk = RUPEE_PATTERN.test(form.fee) && RUPEE_PATTERN.test(form.freeThreshold)
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(settings))

  async function submit(event) {
    event.preventDefault()
    setErrors({})
    try {
      await save({
        shipping: { fee: rupeesToPaise(form.fee), freeThreshold: rupeesToPaise(form.freeThreshold), firstOrderFree: form.firstOrderFree },
        announcement: { message: form.message.trim() },
        support: { email: form.email.trim(), phone: form.phone.trim() },
      }).unwrap()
      toast.success('Settings saved')
    } catch (error) {
      setErrors(getFieldErrors(error))
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection
        title="Delivery"
        description="Charged per seller shipment. Changes apply to carts right away; placed orders keep their fee."
        actions={<Truck className="size-5 text-brand-600" />}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Delivery fee (₹)" inputMode="decimal" value={form.fee} onChange={set('fee')} error={errors['shipping.fee']} />
          <Input
            label="Free delivery from (₹)"
            inputMode="decimal"
            value={form.freeThreshold}
            onChange={set('freeThreshold')}
            hint="Shipments worth this much or more ship free"
            error={errors['shipping.freeThreshold']}
          />
        </div>
        <Switch
          checked={form.firstOrderFree}
          onChange={(firstOrderFree) => setForm((f) => ({ ...f, firstOrderFree }))}
          label="Free delivery on a customer's first order"
          description="Also shown in the storefront top bar to guests and new customers."
        />
      </FormSection>

      <FormSection
        title="Announcement bar"
        description="The strip at the top of the storefront. Leave empty to show the automatic delivery offer."
        actions={<Megaphone className="size-5 text-brand-600" />}
      >
        <Input
          label="Message (optional)"
          maxLength={140}
          value={form.message}
          onChange={set('message')}
          placeholder="e.g. Diwali sale: 10% off with DIWALI10"
          hint={`${form.message.length}/140`}
          error={errors['announcement.message']}
        />
      </FormSection>

      <FormSection title="Support contact" description="Shown to customers who need help." actions={<LifeBuoy className="size-5 text-brand-600" />}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Support email" type="email" value={form.email} onChange={set('email')} error={errors['support.email']} />
          <Input label="Support phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+919876543210" error={errors['support.phone']} />
        </div>
      </FormSection>

      <FormSection title="Money" description="Set elsewhere or in the server configuration." actions={<HandCoins className="size-5 text-brand-600" />}>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Commission</dt>
            <dd className="mt-0.5">
              <Link to="/admin/payouts" className="font-medium text-brand-600 hover:text-brand-700">
                Change on the Payouts page
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Earnings hold / return window</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{settings.readOnly.earningsHoldDays} days (EARNINGS_HOLD_DAYS)</dd>
          </div>
          <div>
            <dt className="text-slate-500">Image storage</dt>
            <dd className="mt-0.5 font-medium text-slate-900 capitalize">{settings.readOnly.uploadDriver}</dd>
          </div>
        </dl>
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white/90 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {settings.updatedAt && (
          <p className="mr-auto text-xs text-slate-500">
            Last saved {formatDateTime(settings.updatedAt)}
            {settings.updatedBy?.name ? ` by ${settings.updatedBy.name}` : ''}
          </p>
        )}
        <Button variant="outline" disabled={!dirty || isLoading} onClick={() => setForm(toForm(settings))}>
          Discard
        </Button>
        <Button type="submit" loading={isLoading} disabled={!dirty || !moneyOk}>
          Save settings
        </Button>
      </div>
      {!moneyOk && <p className="text-sm text-rose-600">Enter delivery amounts like 49 or 49.50</p>}
    </form>
  )
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useGetAdminSettingsQuery()

  return (
    <>
      <PageHeader title="Platform settings" description="Delivery terms, the storefront announcement and support contact." />
      {isLoading || !settings ? (
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : (
        <SettingsForm key={settings.updatedAt ?? 'defaults'} settings={settings} />
      )}
    </>
  )
}
