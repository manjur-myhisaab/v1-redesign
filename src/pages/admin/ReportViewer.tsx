import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, FileText } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'

export default function ReportViewer() {
  const navigate = useNavigate()
  const location = useLocation()
  const { blobUrl, title } = (location.state as { blobUrl?: string; title?: string }) || {}

  const handleDownload = () => {
    if (!blobUrl) return
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `${title || 'Attendance_Report'}_${Date.now()}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Panel className="p-4 md:p-6 flex-1 flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/reports')}
            className="size-8 cursor-pointer"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title || 'Report Viewer'}</h1>
            <p className="text-xs text-muted-foreground">Preview generated PDF report document</p>
          </div>
        </div>

        <Button
          onClick={handleDownload}
          disabled={!blobUrl}
          className="gap-2 cursor-pointer"
        >
          <Download className="size-4" />
          <span>Download PDF</span>
        </Button>
      </div>

      <div className="flex-1 rounded-lg border border-border bg-card overflow-hidden">
        {blobUrl ? (
          <iframe
            src={blobUrl}
            title="PDF Preview"
            className="w-full h-full border-none bg-muted/20"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
            <FileText className="size-8 stroke-[1.5]" />
            <p>No report loaded. Please generate a report from the Reports page.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/reports')}
              className="mt-2"
            >
              Go to Reports
            </Button>
          </div>
        )}
      </div>
    </Panel>
  )
}
