import PageHeader from '@/components/common/PageHeader'
import ReturnsManager from '@/components/shop/ReturnsManager'
import { useDecideSellerReturnMutation, useGetSellerReturnsQuery } from '@/features/seller/sellerApi'

export default function ReturnsPage() {
  return (
    <>
      <PageHeader
        title="Returns"
        description="Approve or decline return requests, then mark the parcel received when it arrives back."
      />
      <ReturnsManager useList={useGetSellerReturnsQuery} useDecide={useDecideSellerReturnMutation} />
    </>
  )
}
