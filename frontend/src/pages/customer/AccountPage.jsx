import ChangePasswordCard from '@/components/account/ChangePasswordCard'
import ProfileCard from '@/components/account/ProfileCard'
import AddressBook from '@/components/shop/AddressBook'

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">My account</h1>
      <p className="mt-1 text-sm text-slate-500">Your profile, password and delivery addresses.</p>

      <div className="mt-6 space-y-6">
        <ProfileCard />
        <ChangePasswordCard />
        <AddressBook />
      </div>
    </div>
  )
}
