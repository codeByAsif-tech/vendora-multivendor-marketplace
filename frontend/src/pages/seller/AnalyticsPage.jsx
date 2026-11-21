import { useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import RangePicker from '@/components/charts/RangePicker'
import ReportView from '@/components/charts/ReportView'
import Card from '@/components/ui/Card'
import { useGetSellerAnalyticsQuery } from '@/features/seller/sellerApi'
import { getErrorMessage } from '@/utils/apiError'

export default function AnalyticsPage() {
  const [range, setRange] = useState('30d')
  const { data: report, isLoading, isFetching, isError, error } = useGetSellerAnalyticsQuery({ range })

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How your store is selling."
        actions={<RangePicker value={range} onChange={setRange} />}
      />
      {isError && (
        <Card className="mb-6 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{getErrorMessage(error, 'Could not load analytics')}</Card>
      )}
      <div className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : undefined}>
        <ReportView report={report} loading={isLoading} range={range} role="seller" />
      </div>
    </>
  )
}
