import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useLoginMutation } from '@/features/auth/authApi'
import AuthLayout from '@/layouts/AuthLayout'
import { getErrorMessage } from '@/utils/apiError'
import { homePathFor } from '@/utils/roles'
import { loginSchema } from './authSchemas'

const portals = {
  customer: {
    title: 'Welcome back',
    subtitle: 'Sign in to track orders, save favourites and check out faster.',
    heading: 'Everything you love, from sellers you trust.',
    subheading: 'Thousands of products from verified independent sellers.',
    highlights: ['Secure checkout', 'Track every order in real time', 'Easy returns'],
    footer: { text: 'New here?', linkText: 'Create an account', to: '/register' },
  },
  seller: {
    title: 'Seller sign in',
    subtitle: 'Manage your store, products and orders.',
    heading: 'Grow your business with us.',
    subheading: 'List products, manage inventory and get paid. All in one place.',
    highlights: ['Reach new customers', 'Clear earnings and payouts', 'Real-time order alerts'],
    footer: { text: 'Want to sell?', linkText: 'Register as a seller', to: '/seller/register' },
  },
  admin: {
    title: 'Admin console',
    subtitle: 'Restricted area. Authorised staff only.',
    heading: 'Marketplace control centre.',
    subheading: 'Sellers, products, orders and payments in one view.',
    highlights: [],
    footer: null,
  },
}

export default function LoginPage({ portal = 'customer' }) {
  const copy = portals[portal]
  const navigate = useNavigate()
  const location = useLocation()
  const [login, { isLoading }] = useLoginMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  async function onSubmit(values) {
    try {
      const { data } = await login({ ...values, portal }).unwrap()
      toast.success(`Welcome back, ${data.user.name.split(' ')[0]}!`)
      navigate(location.state?.from || homePathFor(data.user.role), { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not sign in'))
    }
  }

  return (
    <AuthLayout portal={portal} heading={copy.heading} subheading={copy.subheading} highlights={copy.highlights}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{copy.title}</h1>
      <p className="mt-2 text-sm text-slate-500">{copy.subtitle}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
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
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          leftIcon={Lock}
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="-mt-2 text-right">
          <Link to={`/forgot-password?portal=${portal}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" fullWidth loading={isLoading}>
          Sign in
        </Button>
      </form>

      {copy.footer && (
        <p className="mt-8 text-center text-sm text-slate-500">
          {copy.footer.text}{' '}
          <Link to={copy.footer.to} className="font-semibold text-brand-600 hover:text-brand-700">
            {copy.footer.linkText}
          </Link>
        </p>
      )}

      {portal === 'customer' && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Are you a seller?{' '}
          <Link to="/seller/login" className="font-medium text-slate-600 hover:text-slate-900">
            Sign in to Seller Hub
          </Link>
        </p>
      )}
    </AuthLayout>
  )
}
