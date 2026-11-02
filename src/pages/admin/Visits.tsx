import { useState, useMemo } from 'react'
import {
  Compass,
  Plus,
  Search,
  Calendar,
  Clock,
  MapPin,
  Trash2,
  Pencil,
  Eye,
  Loader2,
  Building2,
  User,
  Phone,
  Paperclip,
  RefreshCw,
  X,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Check,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import ExcelJS from 'exceljs'
import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import ImageLightbox from '@/components/ui/image-lightbox'
import FileDropzone from '@/components/ui/file-dropzone'
import { useResizableColumns, ColumnResizer } from '@/hooks/useResizableColumns'
import { EmployeeAvatar } from '@/lib/people'
import rdk, {
  API_URL,
  ATTENDANCE_SERVER_URL,
  readItems,
  createItem,
  updateItem,
  deleteItem,
  deleteItems,
  uploadFiles,
  customEndpoint,
} from '@/services/server'
import { cn } from '@/lib/utils'

interface Client {
  client_id: string
  client_name: string
  client_phone?: string
  client_email?: string
  client_address?: string
  client_city?: string
  client_contact_person?: string
}

interface AssignedEmployee {
  id: string
  first_name: string
  last_name: string
  email?: string
  avatar?: string
  employee_serial_no?: string
  employee_code?: string
  title?: string
}

interface VisitImage {
  id?: string
  directus_files_id?: string
  [key: string]: any
}

interface Visit {
  visit_id: string
  client_id?: Client
  assigned_employee_id?: AssignedEmployee
  visit_date?: string
  visit_time?: string
  visit_geoaddress?: string
  visit_remarks?: string
  visit_images?: VisitImage[]
  status?: string
  date_created?: string
  date_updated?: string
}

export default function Visits() {
  const { firstTabActive } = useShell()
  const { user, activeWorkspace } = useAuth()
  const queryClient = useQueryClient()

  const firmObj = (typeof user?.firm_id === 'object' ? user?.firm_id : null) as any
  const firmId =
    firmObj?.firm_id ||
    (typeof user?.firm_id === 'string' ? user?.firm_id : null) ||
    activeWorkspace?.id
  const firmName =
    firmObj?.firm_name ||
    (typeof user?.firm_name === 'string' ? user?.firm_name : null) ||
    activeWorkspace?.name ||
    'Company'

  // Filter & Search states
  const [search, setSearch] = useState('')
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all')
  const [filterClientId, setFilterClientId] = useState<string>('all')
  const [filterHasImages, setFilterHasImages] = useState<string>('all')
  const [sortSelected, setSortSelected] = useState<string>('date desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Resizable columns
  const { colWidths, startResizing, isResizing, canSort } = useResizableColumns(
    {
      client: 240,
      employee: 200,
      date: 180,
      address: 240,
      photos: 100,
      actions: 110,
    },
    { storageKey: 'visits_table_widths', minWidth: 80 },
  )

  // Selection states
  const [selectedVisitIds, setSelectedVisitIds] = useState<string[]>([])
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [visitToDelete, setVisitToDelete] = useState<Visit | null>(null)

  // Drawer & Modal states
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)

  // Popover open states
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)

  // Form states for Create/Edit
  const [formClientId, setFormClientId] = useState('')
  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formVisitDate, setFormVisitDate] = useState('')
  const [formVisitTime, setFormVisitTime] = useState('')
  const [formStatus, setFormStatus] = useState('completed')
  const [formGeoaddress, setFormGeoaddress] = useState('')
  const [formRemarks, setFormRemarks] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxTitle, setLightboxTitle] = useState('')

  // 1. Fetch Visits
  const {
    data: visits = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<Visit[]>({
    queryKey: ['visits'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('visits', {
          sort: ['-visit_date', '-date_created'],
          limit: -1,
          fields: ['*', 'client_id.*', 'assigned_employee_id.*', 'visit_images.*'],
        }),
      )
      return Array.isArray(res) ? (res as Visit[]) : []
    },
  })

  // 2. Fetch Clients for dropdown & filtering
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('clients', {
          sort: ['client_name'],
          limit: -1,
          fields: ['client_id', 'client_name', 'client_phone', 'client_city', 'client_address'],
        }),
      )
      return Array.isArray(res) ? (res as Client[]) : []
    },
    staleTime: 5 * 60 * 1000,
  })

  // 3. Fetch Firm Users for assigned employee dropdown
  const { data: employees = [] } = useQuery<AssignedEmployee[]>({
    queryKey: ['firm_employees_for_visits', firmId],
    queryFn: async () => {
      try {
        const queryParams: any = {
          limit: -1,
          fields: ['id', 'first_name', 'last_name', 'email', 'avatar', 'title'],
        }
        if (firmId) {
          queryParams.filter = {
            firm_id: { _eq: firmId },
            status: { _nin: ['archived', 'suspended'] },
          }
        } else {
          queryParams.filter = {
            status: { _nin: ['archived', 'suspended'] },
          }
        }

        const res: any = await rdk.request(
          customEndpoint({
            path: 'users',
            method: 'GET',
            params: queryParams,
          }),
        )
        const rawList = Array.isArray(res) ? (res as AssignedEmployee[]) : res?.data || []
        const list = rawList.filter((u: any) => { const st = (u.status || '').toLowerCase(); return st !== 'archived' && st !== 'suspended'; })
        if (list.length === 0) {
          const cached = localStorage.getItem('all_users_of_firm')
          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              if (Array.isArray(parsed) && parsed.length > 0) return parsed
            } catch {}
          }
        }
        return list
      } catch (err) {
        console.error('Failed to load users:', err)
        const cached = localStorage.getItem('all_users_of_firm')
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (Array.isArray(parsed) && parsed.length > 0) return parsed
          } catch {}
        }
        return []
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  // Unique list of employees for the filter dropdown
  const filterEmployeeOptions = useMemo(() => {
    const map = new Map<string, string>()
    if (Array.isArray(employees)) {
      employees.forEach((emp) => {
        if (emp?.id) {
          const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff'
          map.set(String(emp.id), name)
        }
      })
    }
    visits.forEach((v) => {
      const emp = v.assigned_employee_id
      if (emp) {
        const id =
          typeof emp === 'object' && emp !== null
            ? String((emp as any).id || '')
            : String(emp)
        if (id && !map.has(id)) {
          const name =
            typeof emp === 'object' && emp !== null
              ? `${(emp as any).first_name || ''} ${(emp as any).last_name || ''}`.trim() ||
                `Staff #${id.slice(-6)}`
              : `Staff #${id.slice(-6)}`
          map.set(id, name)
        }
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [employees, visits])

  // Filtered & Sorted Visits
  const filteredAndSortedVisits = useMemo(() => {
    let result = [...visits]

    // Employee Filter
    if (filterEmployeeId !== 'all') {
      result = result.filter((v) => {
        const empId =
          typeof v.assigned_employee_id === 'object' && v.assigned_employee_id !== null
            ? String((v.assigned_employee_id as any).id || '')
            : String(v.assigned_employee_id || '')
        return empId === filterEmployeeId
      })
    }

    // Client Filter
    if (filterClientId !== 'all') {
      result = result.filter((v) => String(v.client_id?.client_id) === filterClientId)
    }

    // Photos Filter
    if (filterHasImages === 'yes') {
      result = result.filter((v) => Array.isArray(v.visit_images) && v.visit_images.length > 0)
    } else if (filterHasImages === 'no') {
      result = result.filter((v) => !Array.isArray(v.visit_images) || v.visit_images.length === 0)
    }

    // Search Query
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((v) => {
        const clientName = v.client_id?.client_name?.toLowerCase() || ''
        const clientPhone = v.client_id?.client_phone?.toLowerCase() || ''
        const empName = `${v.assigned_employee_id?.first_name || ''} ${v.assigned_employee_id?.last_name || ''}`.toLowerCase()
        const addr = v.visit_geoaddress?.toLowerCase() || ''
        const rem = v.visit_remarks?.toLowerCase() || ''
        const date = v.visit_date?.toLowerCase() || ''
        return (
          clientName.includes(q) ||
          clientPhone.includes(q) ||
          empName.includes(q) ||
          addr.includes(q) ||
          rem.includes(q) ||
          date.includes(q)
        )
      })
    }

    // Sorting
    result.sort((a, b) => {
      if (sortSelected === 'date desc') {
        const da = a.visit_date ? new Date(`${a.visit_date}T${a.visit_time || '00:00'}`).getTime() : 0
        const db = b.visit_date ? new Date(`${b.visit_date}T${b.visit_time || '00:00'}`).getTime() : 0
        return db - da
      }
      if (sortSelected === 'date asc') {
        const da = a.visit_date ? new Date(`${a.visit_date}T${a.visit_time || '00:00'}`).getTime() : 0
        const db = b.visit_date ? new Date(`${b.visit_date}T${b.visit_time || '00:00'}`).getTime() : 0
        return da - db
      }
      if (sortSelected === 'client asc') {
        return (a.client_id?.client_name || '').localeCompare(b.client_id?.client_name || '')
      }
      if (sortSelected === 'client desc') {
        return (b.client_id?.client_name || '').localeCompare(a.client_id?.client_name || '')
      }
      if (sortSelected === 'employee asc') {
        const ea = `${a.assigned_employee_id?.first_name || ''} ${a.assigned_employee_id?.last_name || ''}`
        const eb = `${b.assigned_employee_id?.first_name || ''} ${b.assigned_employee_id?.last_name || ''}`
        return ea.localeCompare(eb)
      }
      if (sortSelected === 'employee desc') {
        const ea = `${a.assigned_employee_id?.first_name || ''} ${a.assigned_employee_id?.last_name || ''}`
        const eb = `${b.assigned_employee_id?.first_name || ''} ${b.assigned_employee_id?.last_name || ''}`
        return eb.localeCompare(ea)
      }
      return 0
    })

    return result
  }, [
    visits,
    filterEmployeeId,
    filterClientId,
    filterHasImages,
    search,
    sortSelected,
  ])

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterEmployeeId !== 'all') count++
    if (filterClientId !== 'all') count++
    if (filterHasImages !== 'all') count++
    return count
  }, [filterEmployeeId, filterClientId, filterHasImages])

  const handleResetFilters = () => {
    setFilterEmployeeId('all')
    setFilterClientId('all')
    setFilterHasImages('all')
    setCurrentPage(1)
  }

  // Column header sort toggle
  const handleSortToggle = (col: 'date' | 'client' | 'employee') => {
    if (!canSort()) return
    if (col === 'date') {
      setSortSelected((prev) => (prev === 'date desc' ? 'date asc' : 'date desc'))
    } else if (col === 'client') {
      setSortSelected((prev) => (prev === 'client asc' ? 'client desc' : 'client asc'))
    } else if (col === 'employee') {
      setSortSelected((prev) => (prev === 'employee asc' ? 'employee desc' : 'employee asc'))
    }
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedVisits.length / itemsPerPage))
  const paginatedVisits = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedVisits.slice(start, start + itemsPerPage)
  }, [filteredAndSortedVisits, currentPage, itemsPerPage])

  // Bulk Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVisitIds(filteredAndSortedVisits.map((v) => String(v.visit_id)))
    } else {
      setSelectedVisitIds([])
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedVisitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  // Lightbox opener
  const openVisitLightbox = (visit: Visit, index = 0) => {
    if (!visit.visit_images || visit.visit_images.length === 0) return
    const urls = visit.visit_images.map((img) => {
      const fileId = typeof img === 'object' ? img.directus_files_id || img.id : img
      return `${ATTENDANCE_SERVER_URL || API_URL}/assets/${fileId}`
    })
    setLightboxImages(urls)
    setLightboxIndex(index)
    setLightboxTitle(
      `${visit.client_id?.client_name || 'Visit'} — Photo #${index + 1}`,
    )
    setLightboxOpen(true)
  }

  // Modal actions
  const openCreateModal = () => {
    setDetailVisit(null)
    setFormClientId(clients[0]?.client_id || '')
    setFormEmployeeId(user?.id || employees[0]?.id || '')
    setFormVisitDate(new Date().toISOString().slice(0, 10))
    setFormVisitTime(
      new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
    )
    setFormStatus('completed')
    setFormGeoaddress('')
    setFormRemarks('')
    setFiles([])
    setModalMode('create')
  }

  const openEditModal = (visit: Visit) => {
    setDetailVisit(visit)
    setFormClientId(visit.client_id?.client_id || '')
    setFormEmployeeId(visit.assigned_employee_id?.id || '')
    setFormVisitDate(visit.visit_date || '')
    setFormVisitTime(visit.visit_time || '')
    setFormStatus(visit.status || 'completed')
    setFormGeoaddress(visit.visit_geoaddress || '')
    setFormRemarks(visit.visit_remarks || '')
    setFiles([])
    setModalMode('edit')
  }

  const openViewDrawer = (visit: Visit) => {
    setDetailVisit(visit)
    setDrawerOpen(true)
  }

  // Delete Mutation (Single)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await rdk.request(deleteItem('visits', id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] })
      toast.success('Visit record deleted successfully')
      setVisitToDelete(null)
      if (drawerOpen && detailVisit?.visit_id === visitToDelete?.visit_id) {
        setDrawerOpen(false)
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete visit record')
    },
  })

  // Bulk Delete Mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await rdk.request(deleteItems('visits', ids as any))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] })
      toast.success(`Successfully deleted ${selectedVisitIds.length} visits`)
      setSelectedVisitIds([])
      setBulkDeleteModalOpen(false)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete selected visits')
    },
  })

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formClientId) {
      toast.error('Please select a client')
      return
    }
    if (!formEmployeeId) {
      toast.error('Please assign an employee')
      return
    }

    setIsSubmitting(true)
    try {
      let uploadedIds: { directus_files_id: string }[] = []
      if (files.length > 0) {
        const fileIds = await uploadFiles(files)
        uploadedIds = fileIds.map((id) => ({ directus_files_id: id }))
      }

      const payload: Record<string, any> = {
        client_id: formClientId,
        assigned_employee_id: formEmployeeId,
        visit_date: formVisitDate,
        visit_time: formVisitTime,
        status: formStatus,
        visit_geoaddress: formGeoaddress.trim(),
        visit_remarks: formRemarks.trim(),
      }

      if (uploadedIds.length > 0) {
        payload.visit_images = uploadedIds
      }

      if (modalMode === 'create') {
        await rdk.request(createItem('visits', payload))
        toast.success('Visit scheduled successfully')
      } else if (modalMode === 'edit' && detailVisit) {
        await rdk.request(updateItem('visits', detailVisit.visit_id, payload))
        toast.success('Visit updated successfully')
      }

      queryClient.invalidateQueries({ queryKey: ['visits'] })
      setModalMode(null)
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to save visit')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Excel Export (Replicating downloadOverallVisitsReports.js) ---
  const handleDownloadExcel = async () => {
    if (visits.length === 0) {
      toast.error('No visit records to export')
      return
    }

    try {
      toast.loading('Generating Excel visit report...', { id: 'visit-excel' })
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Visits Report')

      const headingFont = { bold: true, size: 14 }
      const subheadingFont = { bold: true, size: 11 }
      const headerFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      }
      const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }

      // Row 1: Firm Name
      worksheet.mergeCells('A1:J1')
      worksheet.getCell('A1').value = firmName || 'Client Visits Report'
      worksheet.getCell('A1').font = headingFont
      worksheet.getCell('A1').alignment = { horizontal: 'center' }

      // Row 2: Subheading
      worksheet.mergeCells('A2:J2')
      worksheet.getCell('A2').value = `Total Records: ${visits.length} | Generated on ${new Date().toLocaleDateString()}`
      worksheet.getCell('A2').font = subheadingFont
      worksheet.getCell('A2').alignment = { horizontal: 'center' }

      worksheet.addRow([])

      // Row 4: Column Headers
      const headers = [
        'VISIT DATE',
        'VISIT TIME',
        'CLIENT NAME',
        'CLIENT PHONE',
        'ASSIGNED EMPLOYEE',
        'STATUS',
        'GEO ADDRESS',
        'REMARKS / AGENDA',
        'ATTACHED PHOTOS',
        'RECORDED ON',
      ]
      const headerRow = worksheet.addRow(headers)
      headerRow.font = { bold: true }
      headerRow.eachCell((cell) => {
        cell.fill = headerFill
        cell.border = borderStyle
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })

      // Column widths
      const colWidths = [15, 14, 25, 18, 22, 14, 35, 35, 16, 20]
      colWidths.forEach((w, i) => {
        worksheet.getColumn(i + 1).width = w
      })

      // Populate Data Rows
      filteredAndSortedVisits.forEach((v) => {
        const empName = `${v.assigned_employee_id?.first_name || ''} ${v.assigned_employee_id?.last_name || ''}`.trim() || '—'
        const imgCount = Array.isArray(v.visit_images) ? v.visit_images.length : 0
        const row = worksheet.addRow([
          v.visit_date || '—',
          v.visit_time || '—',
          v.client_id?.client_name || '—',
          v.client_id?.client_phone || '—',
          empName,
          (v.status || 'draft').toUpperCase(),
          v.visit_geoaddress || '—',
          v.visit_remarks || '—',
          imgCount > 0 ? `${imgCount} photo(s)` : 'None',
          v.date_created ? new Date(v.date_created).toLocaleString() : '—',
        ])
        row.eachCell((cell) => {
          cell.border = borderStyle
          cell.alignment = { vertical: 'middle' }
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `Visits_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
      link.click()
      URL.revokeObjectURL(link.href)

      toast.success('Excel report downloaded successfully!', { id: 'visit-excel' })
    } catch (err) {
      console.error('Failed to export Excel:', err)
      toast.error('Failed to generate Excel report', { id: 'visit-excel' })
    }
  }

  // Formatters
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '—'
    try {
      if (timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':')
        const h = parseInt(hours, 10)
        const m = parseInt(minutes, 10)
        const ampm = h >= 12 ? 'PM' : 'AM'
        const formattedH = h % 12 || 12
        return `${formattedH}:${String(m).padStart(2, '0')} ${ampm}`
      }
      return timeStr
    } catch {
      return timeStr
    }
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col h-full overflow-hidden',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        {/* 1. Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Compass className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-foreground">
                  Client Visits
                </h1>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {visits.length} Total
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Monitor on-ground client visits, field agents, meetings, and geo-locations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Excel Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadExcel}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
              title="Download Excel Report"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Export Excel
            </Button>

            {/* Schedule Visit Button */}
            <Button
              size="sm"
              onClick={openCreateModal}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-xs"
            >
              <Plus className="size-3.5" />
              Schedule Visit
            </Button>
          </div>
        </div>

        {/* 2. Toolbar: Bulk Selection OR (Search + Filter + Sort + Refresh) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 bg-card shrink-0">
          {selectedVisitIds.length > 0 ? (
            /* Bulk selection toolbar */
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={() => setSelectedVisitIds([])}
                className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear selection"
              >
                <X className="size-3.5" />
              </button>
              <span className="text-[13px] font-medium text-primary">
                {selectedVisitIds.length} visits selected
              </span>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkDeleteModalOpen(true)}
                  className="h-7 text-xs gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="size-3.5" />
                  Delete Selected
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedVisitIds([])}
                  className="h-7 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            /* Normal Toolbar */
            <>
              {/* Left indicator count */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {filteredAndSortedVisits.length} {filteredAndSortedVisits.length === 1 ? 'visit' : 'visits'}
                </span>
              </div>

              {/* Search, Filter, Sort, Refresh */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] sm:w-64">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by client, staff, location..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="h-7.5 pl-8 pr-7 text-xs bg-muted/30 focus-visible:bg-background rounded-lg"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                {/* Filter Popover */}
                <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors cursor-pointer border border-transparent h-7.5',
                        activeFilterCount > 0 &&
                          'text-primary font-semibold border-primary/20 bg-primary/5',
                      )}
                    >
                      <Filter className="size-3.5" />
                      <span>Filter</span>
                      {activeFilterCount > 0 && (
                        <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-3.5 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <p className="text-xs font-bold text-foreground">Filter Visits</p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Reset all
                        </button>
                      )}
                    </div>

                    {/* Filter by Staff */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Assigned Employee
                      </label>
                      <Select
                        value={filterEmployeeId}
                        onValueChange={(val) => {
                          setFilterEmployeeId(val)
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="All Staff Members" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          <SelectItem value="all">All Staff Members</SelectItem>
                          {filterEmployeeOptions.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filter by Client */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Client Entity
                      </label>
                      <Select
                        value={filterClientId}
                        onValueChange={(val) => {
                          setFilterClientId(val)
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="All Clients" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          <SelectItem value="all">All Clients</SelectItem>
                          {clients.map((c) => (
                            <SelectItem key={c.client_id} value={c.client_id}>
                              {c.client_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filter by Photos */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Proof Photos
                      </label>
                      <Select
                        value={filterHasImages}
                        onValueChange={(val) => {
                          setFilterHasImages(val)
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Visits</SelectItem>
                          <SelectItem value="yes">With Photos</SelectItem>
                          <SelectItem value="no">Without Photos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Sort Popover */}
                <Popover open={sortPopoverOpen} onOpenChange={setSortPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors cursor-pointer border border-transparent h-7.5"
                    >
                      <ArrowUpDown className="size-3.5" />
                      <span>Sort</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-1.5 shadow-lg space-y-0.5">
                    {[
                      { key: 'date desc', label: 'Date: Newest First' },
                      { key: 'date asc', label: 'Date: Oldest First' },
                      { key: 'client asc', label: 'Client: A to Z' },
                      { key: 'client desc', label: 'Client: Z to A' },
                      { key: 'employee asc', label: 'Employee: A to Z' },
                      { key: 'employee desc', label: 'Employee: Z to A' },
                    ].map((opt) => {
                      const isSelected = sortSelected === opt.key
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setSortSelected(opt.key)
                            setSortPopoverOpen(false)
                          }}
                          className={cn(
                            'flex w-full items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors text-left',
                            isSelected
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-foreground hover:bg-muted',
                          )}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check className="size-3.5 text-primary" />}
                        </button>
                      )
                    })}
                  </PopoverContent>
                </Popover>

                {/* Refresh */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => refetch()}
                  className="size-7 cursor-pointer text-muted-foreground hover:text-foreground rounded-md"
                  title="Refresh visits"
                >
                  <RefreshCw
                    className={cn('size-3.5', isFetching && 'animate-spin text-primary')}
                  />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* 3. Main Spreadsheet Grid Table with Resizable Columns */}
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20 bg-card shadow-2xs">
              <tr className="text-muted-foreground font-semibold">
                {/* Sticky Checkbox */}
                <th className="sticky left-0 top-0 z-30 bg-card py-2.5 px-3 w-10 text-center border-t border-b border-l border-r border-gray-200 dark:border-border shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                  <Checkbox
                    checked={
                      filteredAndSortedVisits.length > 0 &&
                      selectedVisitIds.length === filteredAndSortedVisits.length
                    }
                    onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  />
                </th>

                {/* Client */}
                <th
                  onClick={() => handleSortToggle('client')}
                  style={{ width: colWidths.client, minWidth: colWidths.client }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>CLIENT</span>
                    {sortSelected.startsWith('client') ? (
                      sortSelected.endsWith('asc') ? (
                        <ArrowUp className="size-3 text-primary" />
                      ) : (
                        <ArrowDown className="size-3 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/40" />
                    )}
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'client'}
                    onMouseDown={(e) => startResizing('client', e)}
                  />
                </th>

                {/* Assigned Employee */}
                <th
                  onClick={() => handleSortToggle('employee')}
                  style={{ width: colWidths.employee, minWidth: colWidths.employee }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>ASSIGNED EMPLOYEE</span>
                    {sortSelected.startsWith('employee') ? (
                      sortSelected.endsWith('asc') ? (
                        <ArrowUp className="size-3 text-primary" />
                      ) : (
                        <ArrowDown className="size-3 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/40" />
                    )}
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'employee'}
                    onMouseDown={(e) => startResizing('employee', e)}
                  />
                </th>

                {/* Date & Time */}
                <th
                  onClick={() => handleSortToggle('date')}
                  style={{ width: colWidths.date, minWidth: colWidths.date }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>DATE & TIME</span>
                    {sortSelected.startsWith('date') ? (
                      sortSelected.endsWith('asc') ? (
                        <ArrowUp className="size-3 text-primary" />
                      ) : (
                        <ArrowDown className="size-3 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/40" />
                    )}
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'date'}
                    onMouseDown={(e) => startResizing('date', e)}
                  />
                </th>

                {/* Geo Location / Address */}
                <th
                  style={{ width: colWidths.address, minWidth: colWidths.address }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                >
                  <span className="pr-2">GEO LOCATION / ADDRESS</span>
                  <ColumnResizer
                    isResizing={isResizing === 'address'}
                    onMouseDown={(e) => startResizing('address', e)}
                  />
                </th>

                {/* Photos */}
                <th
                  style={{ width: colWidths.photos, minWidth: colWidths.photos }}
                  className="relative py-2.5 px-3 text-center border-t border-b border-r border-gray-200 dark:border-border"
                >
                  <span className="pr-2">PHOTOS</span>
                  <ColumnResizer
                    isResizing={isResizing === 'photos'}
                    onMouseDown={(e) => startResizing('photos', e)}
                  />
                </th>

                {/* Actions */}
                <th
                  style={{ width: colWidths.actions, minWidth: colWidths.actions }}
                  className="py-2.5 px-3 text-right border-t border-b border-r border-gray-200 dark:border-border"
                >
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <p className="text-sm font-medium">Loading visits log...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedVisits.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Compass className="size-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium">No visit records found</p>
                      <p className="text-xs text-muted-foreground">
                        Try modifying your search criteria or schedule a new client visit.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedVisits.map((visit) => {
                  const isChecked = selectedVisitIds.includes(String(visit.visit_id))
                  const imgCount = Array.isArray(visit.visit_images)
                    ? visit.visit_images.length
                    : 0
                  const empName = `${visit.assigned_employee_id?.first_name || ''} ${visit.assigned_employee_id?.last_name || ''}`.trim()

                  return (
                    <tr
                      key={visit.visit_id}
                      onClick={() => openViewDrawer(visit)}
                      className={cn(
                        'group transition-colors cursor-pointer hover:bg-muted/40',
                        isChecked && 'bg-primary/5',
                      )}
                    >
                      {/* Checkbox (Sticky Left) */}
                      <td
                        className={cn(
                          'sticky left-0 z-10 py-2.5 px-3 text-center border-b border-l border-r border-gray-200 dark:border-border transition-colors shadow-[1px_0_0_0_rgba(0,0,0,0.06)]',
                          isChecked ? 'bg-primary/5' : 'bg-card group-hover:bg-muted/40',
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleSelectOne(String(visit.visit_id))
                        }}
                      >
                        <Checkbox checked={isChecked} />
                      </td>

                      {/* Client */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Building2 className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {visit.client_id?.client_name || 'Unspecified Client'}
                            </p>
                            {visit.visit_remarks && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                {visit.visit_remarks}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Assigned Employee */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        {visit.assigned_employee_id ? (
                          <div className="flex items-center gap-2">
                            <EmployeeAvatar
                              employeeId={visit.assigned_employee_id.id}
                              name={empName || 'Staff'}
                              avatar={visit.assigned_employee_id.avatar}
                              className="size-7 shrink-0 text-xs"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {empName || 'Field Agent'}
                              </p>
                              {visit.assigned_employee_id.title && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {visit.assigned_employee_id.title}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="flex items-center gap-1.5 font-medium text-foreground">
                            <Calendar className="size-3 text-muted-foreground shrink-0" />
                            <span>{visit.visit_date || '—'}</span>
                          </span>
                          {visit.visit_time && (
                            <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                              <Clock className="size-3 shrink-0" />
                              <span>{formatTime(visit.visit_time)}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Geo Location / Address */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        {visit.visit_geoaddress ? (
                          <div className="flex items-center gap-1.5 max-w-[220px]">
                            <MapPin className="size-3 text-muted-foreground shrink-0" />
                            <span
                              className="text-foreground truncate text-xs"
                              title={visit.visit_geoaddress}
                            >
                              {visit.visit_geoaddress}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Attached Photos */}
                      <td className="py-2.5 px-3 text-center border-b border-r border-gray-200 dark:border-border">
                        {imgCount > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openVisitLightbox(visit, 0)
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                            title="View proof photos"
                          >
                            <Paperclip className="size-3" />
                            {imgCount}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-2.5 px-3 text-right border-b border-r border-gray-200 dark:border-border"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openViewDrawer(visit)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="View Visit Details"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(visit)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit Visit"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setVisitToDelete(visit)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                            title="Delete Visit"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Bottom Sticky Pagination Bar */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground bg-card shadow-2xs shrink-0">
          <div className="flex items-center gap-1.5">
            <span>Show</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(val) => {
                setItemsPerPage(Number(val))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-6 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>per page · {filteredAndSortedVisits.length} visits</span>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="grid size-6 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="grid size-6 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Panel>

      {/* 6. Slide-Over Detail Drawer (Sheet) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col h-full bg-card border-l border-border"
        >
          {detailVisit && (
            <>
              {/* Drawer Header with non-colliding badge */}
              <SheetHeader className="px-5 py-4 border-b border-border bg-muted/20 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Visit Overview
                    </p>
                    <SheetTitle className="text-base font-bold text-foreground truncate mt-0.5">
                      {detailVisit.client_id?.client_name || 'Unspecified Client'}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                      ID: #{detailVisit.visit_id}
                    </SheetDescription>
                  </div>

                  {/* Status Badge with mr-8 so sheet close button never overlaps */}
                  <div className="mr-8 shrink-0">
                    {(detailVisit.status || '').toLowerCase() === 'completed' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-500/20">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        Draft
                      </span>
                    )}
                  </div>
                </div>
              </SheetHeader>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Client Information */}
                <div className="rounded-xl border border-border p-3.5 space-y-2 bg-muted/10">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Building2 className="size-3.5 text-primary" />
                    <span>Client Details</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-foreground">
                      {detailVisit.client_id?.client_name || '—'}
                    </p>
                    {detailVisit.client_id?.client_contact_person && (
                      <p className="text-muted-foreground flex items-center gap-1.5">
                        <User className="size-3 text-muted-foreground shrink-0" />
                        <span>{detailVisit.client_id.client_contact_person}</span>
                      </p>
                    )}
                    {detailVisit.client_id?.client_phone && (
                      <p className="text-muted-foreground flex items-center gap-1.5">
                        <Phone className="size-3 text-muted-foreground shrink-0" />
                        <a
                          href={`tel:${detailVisit.client_id.client_phone}`}
                          className="hover:text-primary transition-colors font-medium text-foreground"
                        >
                          {detailVisit.client_id.client_phone}
                        </a>
                      </p>
                    )}
                    {detailVisit.client_id?.client_address && (
                      <p className="text-muted-foreground flex items-start gap-1.5 pt-0.5">
                        <MapPin className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                        <span>{detailVisit.client_id.client_address}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Assigned Employee */}
                <div className="rounded-xl border border-border p-3.5 space-y-2 bg-muted/10">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <User className="size-3.5 text-primary" />
                    <span>Assigned Field Agent</span>
                  </div>
                  {detailVisit.assigned_employee_id ? (
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar
                        employeeId={detailVisit.assigned_employee_id.id}
                        name={`${detailVisit.assigned_employee_id.first_name || ''} ${detailVisit.assigned_employee_id.last_name || ''}`}
                        avatar={detailVisit.assigned_employee_id.avatar}
                        className="size-10 text-sm"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-xs">
                          {detailVisit.assigned_employee_id.first_name}{' '}
                          {detailVisit.assigned_employee_id.last_name}
                        </p>
                        {detailVisit.assigned_employee_id.email && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {detailVisit.assigned_employee_id.email}
                          </p>
                        )}
                        {detailVisit.assigned_employee_id.title && (
                          <p className="text-[10px] text-primary font-medium mt-0.5">
                            {detailVisit.assigned_employee_id.title}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No employee assigned.</p>
                  )}
                </div>

                {/* Schedule & Time */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-border p-3 bg-muted/10">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                      <Calendar className="size-3 text-primary" />
                      Visit Date
                    </span>
                    <p className="font-semibold text-foreground">
                      {detailVisit.visit_date || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3 bg-muted/10">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                      <Clock className="size-3 text-primary" />
                      Visit Time
                    </span>
                    <p className="font-semibold text-foreground">
                      {formatTime(detailVisit.visit_time)}
                    </p>
                  </div>
                </div>

                {/* Geo Location / Map */}
                {detailVisit.visit_geoaddress && (
                  <div className="rounded-xl border border-border p-3.5 space-y-2 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <MapPin className="size-3.5 text-primary" />
                        <span>Geo Location</span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          detailVisit.visit_geoaddress,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <span>Open Map</span>
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                    <p className="text-xs text-foreground bg-card p-2 rounded-lg border border-border">
                      {detailVisit.visit_geoaddress}
                    </p>
                  </div>
                )}

                {/* Remarks / Agenda */}
                {detailVisit.visit_remarks && (
                  <div className="rounded-xl border border-border p-3.5 space-y-1.5 bg-muted/10">
                    <p className="text-xs font-bold text-foreground">Meeting Agenda & Remarks</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {detailVisit.visit_remarks}
                    </p>
                  </div>
                )}

                {/* Attached Proof Photos */}
                {Array.isArray(detailVisit.visit_images) &&
                  detailVisit.visit_images.length > 0 && (
                    <div className="rounded-xl border border-border p-3.5 space-y-2.5 bg-muted/10">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Paperclip className="size-3.5 text-primary" />
                          <span>Proof Photos ({detailVisit.visit_images.length})</span>
                        </p>
                        <span className="text-[11px] text-muted-foreground">Click to enlarge</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {detailVisit.visit_images.map((img, idx) => {
                          const fileId =
                            typeof img === 'object' ? img.directus_files_id || img.id : img
                          const src = `${ATTENDANCE_SERVER_URL || API_URL}/assets/${fileId}`
                          return (
                            <button
                              key={fileId || idx}
                              type="button"
                              onClick={() => openVisitLightbox(detailVisit, idx)}
                              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted cursor-pointer shadow-2xs hover:opacity-90 transition-opacity"
                            >
                              <img
                                src={src}
                                alt={`Visit attachment ${idx + 1}`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                loading="lazy"
                              />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
              </div>

              {/* Drawer Bottom Actions */}
              <div className="border-t border-border p-4 bg-card shrink-0 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisitToDelete(detailVisit)}
                  className="h-8 gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  Delete Visit
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDrawerOpen(false)}
                    className="h-8 text-xs cursor-pointer"
                  >
                    Close
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setDrawerOpen(false)
                      openEditModal(detailVisit)
                    }}
                    className="h-8 gap-1.5 text-xs cursor-pointer"
                  >
                    <Pencil className="size-3.5" />
                    Edit Visit
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 7. Create / Edit Sheet */}
      <Sheet
        open={modalMode === 'create' || modalMode === 'edit'}
        onOpenChange={(open) => !open && setModalMode(null)}
      >
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col bg-background">
          <div className="p-5 border-b border-border bg-muted/20">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {modalMode === 'create' ? 'Schedule New Visit' : 'Edit Visit Details'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Provide client, agent assignment, date, and field verification details.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
            {/* Client Select */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Select Client *</label>
              <Select value={formClientId} onValueChange={setFormClientId} required>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Choose client..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {clients.map((c) => (
                    <SelectItem key={c.client_id} value={c.client_id}>
                      {c.client_name} {c.client_city ? `(${c.client_city})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assigned Employee Select */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Assign Employee *</label>
              <Select value={formEmployeeId} onValueChange={setFormEmployeeId} required>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Choose employee..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} {e.title ? `(${e.title})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date, Time & Status */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Visit Date *</label>
                <Input
                  type="date"
                  value={formVisitDate}
                  onChange={(e) => setFormVisitDate(e.target.value)}
                  className="h-8 text-xs bg-background"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Visit Time</label>
                <Input
                  type="time"
                  value={formVisitTime}
                  onChange={(e) => setFormVisitTime(e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Status</label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Geo Location Address */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Location / Geoaddress</label>
              <Input
                value={formGeoaddress}
                onChange={(e) => setFormGeoaddress(e.target.value)}
                placeholder="e.g. 104 MG Road, Indiranagar, Bengaluru"
                className="h-8 text-xs bg-background"
              />
            </div>

            {/* Remarks / Agenda */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Remarks / Meeting Agenda</label>
              <textarea
                value={formRemarks}
                onChange={(e) => setFormRemarks(e.target.value)}
                rows={3}
                placeholder="Notes about discussion, requirements, or next steps..."
                className="w-full rounded-md border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Photos Upload Dropzone */}
            <FileDropzone
              files={files}
              onChange={setFiles}
              label="Attach Photos / Verification Proof"
              description="PNG, JPG images up to 10MB"
              accept="image/*"
              multiple
              onPreviewImage={(url, name) => {
                setLightboxImages([url])
                setLightboxIndex(0)
                setLightboxTitle(name || 'Attachment Preview')
                setLightboxOpen(true)
              }}
            />

            </div>

            {/* Sheet Footer with non-overlapping gap */}
            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalMode(null)}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8 text-xs cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                {modalMode === 'create' ? 'Schedule Visit' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* 8. Single Delete Confirmation AlertDialog */}
      <AlertDialog
        open={Boolean(visitToDelete)}
        onOpenChange={(open) => !open && setVisitToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Visit Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the visit for{' '}
              <strong className="text-foreground">
                {visitToDelete?.client_id?.client_name || 'this client'}
              </strong>{' '}
              on {visitToDelete?.visit_date || 'this date'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row items-center justify-end gap-3 pt-3 border-t border-border mt-3">
            <AlertDialogCancel className="h-8 text-xs cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (visitToDelete) {
                  deleteMutation.mutate(visitToDelete.visit_id)
                }
              }}
              className="h-8 text-xs bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
            >
              Delete Visit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 9. Bulk Delete Confirmation AlertDialog */}
      <AlertDialog
        open={bulkDeleteModalOpen}
        onOpenChange={(open) => !open && setBulkDeleteModalOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Visits</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{' '}
              <strong className="text-foreground">{selectedVisitIds.length}</strong> selected visit
              records? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row items-center justify-end gap-3 pt-3 border-t border-border mt-3">
            <AlertDialogCancel className="h-8 text-xs cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedVisitIds)}
              className="h-8 text-xs bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
            >
              Delete {selectedVisitIds.length} Visits
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 10. High-Resolution Image Lightbox */}
      <ImageLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        src={lightboxImages[lightboxIndex] || null}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
        title={lightboxTitle}
      />
    </div>
  )
}
