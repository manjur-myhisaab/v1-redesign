import MetricCard from '@/components/admin/MetricCard'

interface MetricsProps {
  metrics: {
    total: number
    active: number
    onNotice: number
    archived: number
  }
}

export default function EmployeesMetrics({ metrics }: MetricsProps) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-4">
      <MetricCard label="Headcount" value={String(metrics.total)} />
      <MetricCard label="Active" value={String(metrics.active)} />
      <MetricCard label="On notice" value={String(metrics.onNotice)} />
      <MetricCard label="Archived" value={String(metrics.archived)} />
    </div>
  )
}
