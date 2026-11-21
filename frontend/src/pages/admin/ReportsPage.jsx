import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import RangePicker from '@/components/charts/RangePicker'
import ReportView from '@/components/charts/ReportView'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useGetAdminAnalyticsQuery } from '@/features/admin/adminApi'
import { getErrorMessage } from '@/utils/apiError'

export default function ReportsPage() {
  const [range, setRange] = useState('30d')
  const { data: report, isLoading, isFetching, isError, error, refetch } = useGetAdminAnalyticsQuery({ range })

  return (
    <>
      <PageHeader
        title="Reports"
        description="Marketplace sales, orders and top performers."
        actions={
          <>
            <RangePicker value={range} onChange={setRange} />
            <Button variant="outline" onClick={refetch} loading={isFetching && !isLoading} aria-label="Refresh">
              <RefreshCw className="size-4" />
            </Button>
          </>
        }
      />
      {isError && (
        <Card className="mb-6 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{getErrorMessage(error, 'Could not load the report')}</Card>
      )}
      <div className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : undefined}>
        <ReportView report={report} loading={isLoading} range={range} role="admin" />
      </div>
    </>
  )
}
