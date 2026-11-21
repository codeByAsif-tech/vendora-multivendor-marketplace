import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Mail, Phone, User } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useRegisterMutation, useRegisterSellerMutation } from '@/features/auth/authApi'
import PasswordChecklist from '@/components/common/PasswordChecklist'
import AuthLayout from '@/layouts/AuthLayout'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'
import { homePathFor } from '@/utils/roles'
import { registerSchema } from './authSchemas'

const portals = {
  customer: {
    title: 'Create your account',
    subtitle: 'It only takes a minute.',
    heading: 'Join a smarter way to shop.',
    subheading: 'One cart, many sellers, one simple checkout.',
    highlights: ['Wishlist and saved addresses', 'Order tracking and history', 'Exclusive coupons'],
    loginPath: '/login',
    nameLabel: 'Full name',
  },
  seller: {
    title: 'Start selling',
    subtitle: 'Create your seller account. You can set up your store next.',
    heading: 'Open your store in minutes.',
    subheading: 'After sign-up you add your store details. Our team reviews and approves your store.',
    highlights: ['No listing fees', 'Transparent commission', 'Dedicated seller dashboard'],
    loginPath: '/seller/login',
    nameLabel: 'Your full name',
  },
}

export default function RegisterPage({ portal = 'customer' }) {
  const copy = portals[portal]
  const navigate = useNavigate()
  const [registerCustomer, customerState] = useRegisterMutation()
  const [registerSeller, sellerState] = useRegisterSellerMutation()
  const isLoading = customerState.isLoading || sellerState.isLoading

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '' },
  })
  const passwordValue = useWatch({ control, name: 'password' }) ?? ''

  async function onSubmit({ name, email, password, phone }) {
    // confirmPassword is client-only; phone is optional.
    const payload = phone ? { name, email, password, phone } : { name, email, password }
    const mutate = portal === 'seller' ? registerSeller : registerCustomer

    try {
      const { data } = await mutate(payload).unwrap()
      toast.success('Account created. Welcome aboard!')
      navigate(homePathFor(data.user.role), { replace: true })
    } catch (error) {
      // Show server validation errors next to the matching fields.
      const fieldErrors = getFieldErrors(error)
      Object.entries(fieldErrors).forEach(([field, message]) => setError(field, { message }))
      toast.error(getErrorMessage(error, 'Could not create account'))
    }
  }

  return (
    <AuthLayout portal={portal} heading={copy.heading} subheading={copy.subheading} highlights={copy.highlights}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{copy.title}</h1>
      <p className="mt-2 text-sm text-slate-500">{copy.subtitle}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <Input
          label={copy.nameLabel}
          autoComplete="name"
          placeholder="Ram Kumar"
          leftIcon={User}
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leftIcon={Mail}
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          placeholder="+919876543210"
          leftIcon={Phone}
          error={errors.phone?.message}
          {...register('phone')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="Choose a password"
            leftIcon={Lock}
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            leftIcon={Lock}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>
        <PasswordChecklist password={passwordValue} className="-mt-2" />
        <Button type="submit" size="lg" fullWidth loading={isLoading}>
          {portal === 'seller' ? 'Create seller account' : 'Create account'}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to={copy.loginPath} className="font-semibold text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
