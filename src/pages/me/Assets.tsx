import { useEffect, useState } from 'react'
import { Laptop } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import { getMyAssets, type MyAssetsPayload } from '@/lib/api'
import { Loading, EmptyState, PageHeader, StatusPill, fmtDate } from './ui'

export default function Assets() {
  const [data, setData] = useState<MyAssetsPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAssets()
      .then(setData)
      .catch(() => setData({ assigned: [], history: [] }))
      .finally(() => setLoading(false))
  }, [])

  const empty = data && data.assigned.length === 0 && data.history.length === 0

  return (
    <Panel className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <PageHeader title="Assets" subtitle="Company property assigned to you" />
      {loading ? (
        <Loading />
      ) : empty ? (
        <EmptyState icon={<Laptop className="size-6 opacity-40" />}>No assets assigned to you.</EmptyState>
      ) : (
        <div className="space-y-6 p-5">
          {/* currently assigned */}
          <div>
            <h2 className="mb-2 text-[13px] font-semibold">Currently held</h2>
            {data!.assigned.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Nothing assigned to you right now.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data!.assigned.map((a) => (
                  <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold">{a.name}</span>
                      <StatusPill status={a.status} />
                    </div>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      {a.assetCode}
                      {a.categoryName && ` · ${a.categoryName}`}
                      {a.serialNo && ` · SN ${a.serialNo}`}
                    </div>
                    <div className="mt-1 text-[12px] capitalize text-muted-foreground">Condition: {a.condition}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* history */}
          <div>
            <h2 className="mb-2 text-[13px] font-semibold">Assignment history</h2>
            {data!.history.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No assignment history.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {data!.history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{h.assetName || h.assetCode || 'Asset'}</div>
                      <div className="text-[12px] text-muted-foreground">
                        Assigned {fmtDate(h.assignedOn)}
                        {h.returnedOn ? ` · returned ${fmtDate(h.returnedOn)}` : ' · still held'}
                        {h.returnCondition && ` · ${h.returnCondition}`}
                      </div>
                    </div>
                    <StatusPill status={h.returnedOn ? 'closed' : 'active'} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}
