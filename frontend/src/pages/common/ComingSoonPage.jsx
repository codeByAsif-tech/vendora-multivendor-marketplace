import { Hammer } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'

/** Placeholder for routes whose features are built in later phases. */
export default function ComingSoonPage({ title, phase }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon={Hammer}
          title="Under construction"
          description={phase ? `This section is built in Phase ${phase}.` : 'This section is coming soon.'}
        />
      </Card>
    </>
  )
}
