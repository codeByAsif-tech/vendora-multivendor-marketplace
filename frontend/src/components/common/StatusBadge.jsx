import Badge from '@/components/ui/Badge'

const STATUS = {
  pending: ['yellow', 'Pending review'],
  approved: ['green', 'Approved'],
  rejected: ['red', 'Rejected'],
  suspended: ['gray', 'Suspended'],
  active: ['green', 'Active'],
  blocked: ['red', 'Blocked'],
  hidden: ['gray', 'Hidden'],
  in: ['green', 'In stock'],
  low: ['yellow', 'Low stock'],
  out: ['red', 'Out of stock'],
}

export default function StatusBadge({ status, label }) {
  const [tone, defaultLabel] = STATUS[status] || ['gray', status]
  return (
    <Badge tone={tone} dot>
      {label || defaultLabel}
    </Badge>
  )
}
