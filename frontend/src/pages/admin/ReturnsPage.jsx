import PageHeader from '@/components/common/PageHeader'
import ReturnsManager from '@/components/shop/ReturnsManager'
import { useDecideAdminReturnMutation, useGetAdminReturnsQuery } from '@/features/admin/adminApi'

export default function AdminReturnsPage() {
  return (
    <>
      <PageHeader
        title="Returns"
        description="Every return request. Sellers handle them; step in when a seller does not respond. Refunds are paid from Payments → Refunds due."
      />
      <ReturnsManager useList={useGetAdminReturnsQuery} useDecide={useDecideAdminReturnMutation} showStore />
    </>
  )
}
