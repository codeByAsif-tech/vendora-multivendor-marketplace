import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Switch from '@/components/ui/Switch'
import { useCreateAddressMutation, useUpdateAddressMutation } from '@/features/shop/shopApi'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'
import { cn } from '@/utils/cn'

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter the full name').max(80),
  phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(3, 'Enter the house / flat and street').max(120),
  line2: z.string().trim().max(120),
  landmark: z.string().trim().max(80),
  city: z.string().trim().min(2, 'Enter the city').max(60),
  state: z.string().trim().min(2, 'Enter the state').max(60),
  postalCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code'),
  type: z.enum(['home', 'work', 'other']),
  isDefault: z.boolean(),
})

const empty = { fullName: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: '', postalCode: '', type: 'home', isDefault: false }

/** Add / edit an address. Calls onSaved(address) after a successful create. */
export default function AddressFormModal({ address, defaultName = '', defaultPhone = '', onClose, onSaved }) {
  const isEdit = Boolean(address)
  const [createAddress, createState] = useCreateAddressMutation()
  const [updateAddress, updateState] = useUpdateAddressMutation()

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: address
      ? Object.fromEntries(Object.keys(empty).map((key) => [key, address[key] ?? empty[key]]))
      : { ...empty, fullName: defaultName, phone: defaultPhone },
  })

  async function onSubmit(values) {
    try {
      if (isEdit) {
        await updateAddress({ id: address._id, ...values }).unwrap()
        toast.success('Address updated')
      } else {
        const saved = await createAddress(values).unwrap()
        toast.success('Address saved')
        onSaved?.(saved)
      }
      onClose()
    } catch (error) {
      Object.entries(getFieldErrors(error)).forEach(([field, message]) => setError(field, { message }))
      toast.error(getErrorMessage(error, 'Could not save the address'))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Edit address' : 'Add a delivery address'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="address-form" loading={createState.isLoading || updateState.isLoading}>
            Save address
          </Button>
        </>
      }
    >
      <form id="address-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
          <Input label="Phone" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
        </div>
        <Input label="House / flat, street" autoComplete="address-line1" error={errors.line1?.message} {...register('line1')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Area (optional)" autoComplete="address-line2" error={errors.line2?.message} {...register('line2')} />
          <Input label="Landmark (optional)" error={errors.landmark?.message} {...register('landmark')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="City" autoComplete="address-level2" error={errors.city?.message} {...register('city')} />
          <Input label="State" autoComplete="address-level1" error={errors.state?.message} {...register('state')} />
          <Input label="PIN code" inputMode="numeric" autoComplete="postal-code" error={errors.postalCode?.message} {...register('postalCode')} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1" role="radiogroup" aria-label="Address type">
                {['home', 'work', 'other'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={field.value === type}
                    onClick={() => field.onChange(type)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium capitalize transition',
                      field.value === type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          />
          <Controller
            control={control}
            name="isDefault"
            render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Use as default" />}
          />
        </div>
      </form>
    </Modal>
  )
}
