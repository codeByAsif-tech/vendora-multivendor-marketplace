import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Landmark, MapPin, Pencil, Store } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import FormSection from '@/components/common/FormSection'
import ImagePicker from '@/components/common/ImagePicker'
import PageHeader from '@/components/common/PageHeader'
import StatusBadge from '@/components/common/StatusBadge'
import EmailVerificationStatus from '@/components/common/EmailVerificationStatus'
import VerifyEmailModal from '@/components/common/VerifyEmailModal'
import StoreStatusBanner from '@/components/seller/StoreStatusBanner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Skeleton from '@/components/ui/Skeleton'
import Textarea from '@/components/ui/Textarea'
import { useAuth } from '@/features/auth/useAuth'
import { useGetMyStoreQuery, useSaveMyStoreMutation, useUploadStoreMediaMutation } from '@/features/seller/sellerApi'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'
import { BUSINESS_TYPE_LABELS } from '@/utils/format'
import { BUSINESS_TYPES, formToPayload, makeStoreSchema, storeToForm } from './storeFormSchema'

const businessOptions = BUSINESS_TYPES.map((value) => ({ value, label: BUSINESS_TYPE_LABELS[value] }))

function StoreMedia({ store, editing }) {
  const [upload, { isLoading, originalArgs }] = useUploadStoreMediaMutation()
  let uploadingField = null
  if (isLoading) uploadingField = originalArgs?.get('logo') ? 'logo' : 'banner'

  async function handleSelect(field, file) {
    const formData = new FormData()
    formData.append(field, file)
    try {
      await upload(formData).unwrap()
      toast.success(field === 'logo' ? 'Logo updated' : 'Banner updated')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Upload failed'))
    }
  }

  return (
    <FormSection title="Branding" description="Your logo and banner appear on your store page and products.">
      {!store && <p className="text-sm text-slate-500">Save your store details first, then add your logo and banner.</p>}
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <ImagePicker
          label="Logo"
          imageUrl={store?.logo?.url}
          disabled={!store || !editing}
          loading={uploadingField === 'logo'}
          onSelect={(file) => handleSelect('logo', file)}
          hint="Square, at least 256×256 px"
        />
        <ImagePicker
          label="Banner"
          shape="wide"
          imageUrl={store?.banner?.url}
          disabled={!store || !editing}
          loading={uploadingField === 'banner'}
          onSelect={(file) => handleSelect('banner', file)}
          hint="Wide, e.g. 1600×400 px"
        />
      </div>
    </FormSection>
  )
}

function StoreForm({ store, editing, onDone }) {
  const { user } = useAuth()
  const isNew = !store
  const [saveStore, { isLoading }] = useSaveMyStoreMutation()
  const [verifyOpen, setVerifyOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(makeStoreSchema(isNew)),
    defaultValues: storeToForm(store, user),
  })

  async function onSubmit(values) {
    setVerifyOpen(false)
    try {
      const response = await saveStore(formToPayload(values)).unwrap()
      toast.success(response.message)
      // The save response is short (GET reloads the full store), so keep what was just saved,
      // minus the account number, which is never shown again after saving.
      reset({ ...values, bank: { ...values.bank, accountNumber: '' } })
      onDone()
    } catch (error) {
      if (error?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setVerifyOpen(true)
        return
      }
      Object.entries(getFieldErrors(error)).forEach(([field, message]) => setError(field, { message }))
      toast.error(getErrorMessage(error, 'Could not save store details'))
    }
  }

  const submitLabel = isNew ? 'Submit for review' : store.status === 'rejected' ? 'Save and resubmit' : 'Save changes'

  function cancelEdit() {
    reset()
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <VerifyEmailModal open={verifyOpen} onClose={() => setVerifyOpen(false)} action="submit your store" />
      {/* Read-only until the seller clicks Edit; fields keep their normal look. */}
      <fieldset disabled={!editing} className="space-y-6">
      <FormSection title="Store details" description="What customers see." actions={<Store className="size-5 text-brand-600" />}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Store name" error={errors.storeName?.message} {...register('storeName')} />
          <Select
            label="Business type"
            placeholder="Choose…"
            options={businessOptions}
            error={errors.businessType?.message}
            {...register('businessType')}
          />
        </div>
        <Textarea
          label="About your store"
          rows={3}
          placeholder="What do you sell? What makes your store special?"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Contact email" type="email" error={errors.contactEmail?.message} {...register('contactEmail')} />
          <Input label="Contact phone" type="tel" placeholder="+919876543210" error={errors.contactPhone?.message} {...register('contactPhone')} />
        </div>
      </FormSection>

      <FormSection title="Business & tax" description="Used to verify your business." actions={<Building2 className="size-5 text-brand-600" />}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="PAN" placeholder="ABCDE1234F" error={errors.pan?.message} {...register('pan')} />
          <Input label="GSTIN (optional)" placeholder="33ABCDE1234F1Z5" error={errors.gstin?.message} {...register('gstin')} />
        </div>
      </FormSection>

      <FormSection title="Pickup address" description="Where orders are collected from." actions={<MapPin className="size-5 text-brand-600" />}>
        <Input label="Address line 1" error={errors.pickupAddress?.line1?.message} {...register('pickupAddress.line1')} />
        <Input label="Address line 2 (optional)" error={errors.pickupAddress?.line2?.message} {...register('pickupAddress.line2')} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="City" error={errors.pickupAddress?.city?.message} {...register('pickupAddress.city')} />
          <Input label="State" error={errors.pickupAddress?.state?.message} {...register('pickupAddress.state')} />
          <Input label="PIN code" inputMode="numeric" error={errors.pickupAddress?.postalCode?.message} {...register('pickupAddress.postalCode')} />
          <Input label="Country" error={errors.pickupAddress?.country?.message} {...register('pickupAddress.country')} />
        </div>
      </FormSection>

      <FormSection
        title="Bank account"
        description="Your earnings are paid to this account. The number is stored encrypted."
        actions={<Landmark className="size-5 text-brand-600" />}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Account holder name" error={errors.bank?.accountHolderName?.message} {...register('bank.accountHolderName')} />
          <Input label="Bank name" error={errors.bank?.bankName?.message} {...register('bank.bankName')} />
          <Input label="IFSC" placeholder="HDFC0001234" error={errors.bank?.ifsc?.message} {...register('bank.ifsc')} />
          <Input
            label="Account number"
            inputMode="numeric"
            autoComplete="off"
            placeholder={store ? `•••• ${store.bank?.accountNumberLast4 ?? ''}` : ''}
            hint={store ? 'Leave empty to keep the saved account.' : undefined}
            error={errors.bank?.accountNumber?.message}
            {...register('bank.accountNumber')}
          />
        </div>
      </FormSection>
      </fieldset>

      {editing && (
      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex justify-end gap-3 border-t border-slate-200 bg-white/90 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {isNew ? (
          <Button variant="outline" disabled={!isDirty || isLoading} onClick={() => reset()}>
            Discard changes
          </Button>
        ) : (
          <Button variant="outline" disabled={isLoading} onClick={cancelEdit}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isLoading}>
          {submitLabel}
        </Button>
      </div>
      )}
    </form>
  )
}

/** Only shown while the seller's email is not verified. */
function UnverifiedEmailNotice() {
  const { user } = useAuth()
  if (user?.emailVerified !== false) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-900">
        Verify <strong>{user.email}</strong> to submit your store for review.
      </p>
      <EmailVerificationStatus />
    </div>
  )
}

export default function StoreSettingsPage() {
  const { data: store, isLoading } = useGetMyStoreQuery()
  const [isEditing, setIsEditing] = useState(false)
  // A seller without a store yet fills the form straight away.
  const editing = !store || isEditing

  return (
    <>
      <PageHeader
        title="Store settings"
        description="Your store profile, business details and payout account."
        actions={
          store && (
            <div className="flex items-center gap-3">
              <StatusBadge status={store.status} />
              {!isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="size-4" /> Edit
                </Button>
              )}
            </div>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {store?.status !== 'approved' && <StoreStatusBanner store={store} showAction={false} />}
          <UnverifiedEmailNotice />
          <StoreMedia store={store} editing={editing} />
          <StoreForm key={store?._id ?? 'new'} store={store} editing={editing} onDone={() => setIsEditing(false)} />
        </div>
      )}
    </>
  )
}
