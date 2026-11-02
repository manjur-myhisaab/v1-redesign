import { useEffect, useState } from 'react'
import { FileText, X, ExternalLink, ScrollText } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import { getMyDocuments, type MyDocumentsPayload, type GeneratedLetter } from '@/lib/api'
import { Loading, EmptyState, PageHeader, StatusPill, fmtDate } from './ui'

export default function Documents() {
  const [data, setData] = useState<MyDocumentsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [letter, setLetter] = useState<GeneratedLetter | null>(null)

  useEffect(() => {
    getMyDocuments()
      .then(setData)
      .catch(() => setData({ documents: [], letters: [] }))
      .finally(() => setLoading(false))
  }, [])

  const empty = data && data.documents.length === 0 && data.letters.length === 0

  return (
    <Panel className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <PageHeader title="Documents" subtitle="Your files and letters" />
      {loading ? (
        <Loading />
      ) : empty ? (
        <EmptyState icon={<FileText className="size-6 opacity-40" />}>No documents or letters yet.</EmptyState>
      ) : (
        <div className="space-y-6 p-5">
          {/* documents */}
          <div>
            <h2 className="mb-2 text-[13px] font-semibold">Files</h2>
            {data!.documents.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No files uploaded for you.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {data!.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="grid size-9 place-items-center rounded-lg bg-muted">
                      <FileText className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{d.title}</div>
                      <div className="text-[12px] text-muted-foreground">
                        {d.categoryName || 'Uncategorized'}
                        {d.expiresOn && ` · expires ${fmtDate(d.expiresOn)}`}
                      </div>
                    </div>
                    {d.fileUrl && (
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline"
                      >
                        Open <ExternalLink className="size-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* letters */}
          <div>
            <h2 className="mb-2 text-[13px] font-semibold">Letters</h2>
            {data!.letters.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No letters issued to you.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {data!.letters.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setLetter(l)}
                      className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="grid size-9 place-items-center rounded-lg bg-muted">
                        <ScrollText className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium">{l.title}</div>
                        <div className="text-[12px] capitalize text-muted-foreground">{l.type}</div>
                      </div>
                      <StatusPill status={l.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {letter && <LetterModal letter={letter} onClose={() => setLetter(null)} />}
    </Panel>
  )
}

function LetterModal({ letter, onClose }: { letter: GeneratedLetter; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">{letter.title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-6">
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-foreground">{letter.content}</pre>
        </div>
      </div>
    </div>
  )
}
