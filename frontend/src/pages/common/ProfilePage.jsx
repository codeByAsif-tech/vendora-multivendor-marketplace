import ChangePasswordCard from '@/components/account/ChangePasswordCard'
import ProfileCard from '@/components/account/ProfileCard'
import PageHeader from '@/components/common/PageHeader'

/** "My profile" for admins and sellers (customers have the same cards on My account). */
export default function ProfilePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="My profile" description="Your personal details and password." />
      <div className="space-y-6">
        <ProfileCard />
        <ChangePasswordCard />
      </div>
    </div>
  )
}
