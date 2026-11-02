import { useState, useMemo } from 'react'
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  User,
  Trash2,
  Pencil,
  Eye,
  Loader2,
  Paperclip,
  RefreshCw,
  X,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Maximize2,
  AlertCircle,
  Check,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
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
import rdk, {
  API_URL,
  ATTENDANCE_SERVER_URL,
  readItems,
  createItem,
  updateItem,
  deleteItem,
  deleteItems,
  uploadFiles,
} from '@/services/server'
import { cn } from '@/lib/utils'

interface ClientImage {
  directus_files_id?: string
  id?: string
  [key: string]: any
}

interface Client {
  client_id: string
  client_name: string
  client_phone?: string
  client_email?: string
  client_contact_person?: string
  client_address?: string
  client_city?: string
  client_remarks?: string
  client_images?: ClientImage[]
  status?: string
  date_created?: string
}

export default function Clients() {
  const { firstTabActive } = useShell()
  const queryClient = useQueryClient()

  // Search & Filter states
  const [search, setSearch] = useState('')
  const [filterCity, setFilterCity] = useState<string>('all')
  const [filterHasPhone, setFilterHasPhone] = useState<string>('all')
  const [filterHasImages, setFilterHasImages] = useState<string>('all')
  const [sortSelected, setSortSelected] = useState<string>('name asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)

  // Resizable columns
  const { colWidths, startResizing, isResizing, canSort } = useResizableColumns(
    {
      name: 240,
      contact: 180,
      phone: 200,
      city: 180,
      photos: 100,
      actions: 110,
    },
    { storageKey: 'clients_table_widths', minWidth: 80 },
  )

  // Selection states
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)

  // Drawer & Modal states
  const [detailClient, setDetailClient] = useState<Client | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxTitle, setLightboxTitle] = useState('')

  // Form states for Create/Edit
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [remarks, setRemarks] = useState('')
  const [statusVal, setStatusVal] = useState<string>('published')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch clients from Directus
  const {
    data: clients = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('clients', {
          sort: ['-date_created'],
          limit: -1,
          fields: ['*', 'client_images.*'],
        }),
      )
      return Array.isArray(res) ? (res as Client[]) : res?.data || []
    },
  })

  // Distinct cities for filter dropdown
  const uniqueCities = useMemo(() => {
    const set = new Set<string>()
    clients.forEach((c) => {
      if (c.client_city?.trim()) {
        set.add(c.client_city.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [clients])

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterCity !== 'all') count++
    if (filterHasPhone !== 'all') count++
    if (filterHasImages !== 'all') count++
    return count
  }, [filterCity, filterHasPhone, filterHasImages])

  const handleResetFilters = () => {
    setFilterCity('all')
    setFilterHasPhone('all')
    setFilterHasImages('all')
    setCurrentPage(1)
  }

  // Column sort toggle
  const handleSortToggle = (columnKey: 'name' | 'city' | 'date') => {
    if (!canSort()) return
    const [currentKey, currentDir] = sortSelected.split(' ')
    if (currentKey === columnKey) {
      setSortSelected(`${columnKey} ${currentDir === 'asc' ? 'desc' : 'asc'}`)
    } else {
      setSortSelected(`${columnKey} asc`)
    }
    setCurrentPage(1)
  }

  // Filtered & Sorted Clients
  const filteredAndSortedClients = useMemo(() => {
    const q = search.trim().toLowerCase()

    const result = clients.filter((c) => {
      // City filter
      if (filterCity !== 'all') {
        if ((c.client_city || '').toLowerCase() !== filterCity.toLowerCase()) return false
      }

      // Has Phone filter
      if (filterHasPhone === 'yes' && !c.client_phone?.trim()) return false
      if (filterHasPhone === 'no' && c.client_phone?.trim()) return false

      // Has Images filter
      const imgCount = Array.isArray(c.client_images) ? c.client_images.length : 0
      if (filterHasImages === 'yes' && imgCount === 0) return false
      if (filterHasImages === 'no' && imgCount > 0) return false

      // Search query
      if (q) {
        const n = c.client_name?.toLowerCase() || ''
        const p = c.client_phone?.toLowerCase() || ''
        const e = c.client_email?.toLowerCase() || ''
        const cp = c.client_contact_person?.toLowerCase() || ''
        const cityStr = c.client_city?.toLowerCase() || ''
        const addr = c.client_address?.toLowerCase() || ''
        const rem = c.client_remarks?.toLowerCase() || ''
        if (
          !n.includes(q) &&
          !p.includes(q) &&
          !e.includes(q) &&
          !cp.includes(q) &&
          !cityStr.includes(q) &&
          !addr.includes(q) &&
          !rem.includes(q)
        ) {
          return false
        }
      }

      return true
    })

    // Sorting
    const [sortKey, sortDir] = sortSelected.split(' ')
    result.sort((a, b) => {
      if (sortKey === 'name') {
        const nameA = (a.client_name || '').toLowerCase()
        const nameB = (b.client_name || '').toLowerCase()
        return sortDir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
      } else if (sortKey === 'city') {
        const cityA = (a.client_city || '').toLowerCase()
        const cityB = (b.client_city || '').toLowerCase()
        return sortDir === 'asc' ? cityA.localeCompare(cityB) : cityB.localeCompare(cityA)
      } else {
        // Date sort
        const dateA = new Date(a.date_created || 0).getTime()
        const dateB = new Date(b.date_created || 0).getTime()
        return sortDir === 'asc' ? dateA - dateB : dateB - dateA
      }
    })

    return result
  }, [clients, search, filterCity, filterHasPhone, filterHasImages, sortSelected])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedClients.length / itemsPerPage) || 1
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedClients.slice(start, start + itemsPerPage)
  }, [filteredAndSortedClients, currentPage, itemsPerPage])

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClientIds(filteredAndSortedClients.map((c) => String(c.client_id)))
    } else {
      setSelectedClientIds([])
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Open Lightbox
  const openClientLightbox = (client: Client, index: number = 0) => {
    if (!Array.isArray(client.client_images) || client.client_images.length === 0) return
    const urls = client.client_images.map((img: any) => {
      const fileId = img.directus_files_id || img.id
      return `${ATTENDANCE_SERVER_URL || API_URL}/assets/${fileId}`
    })
    setLightboxImages(urls)
    setLightboxIndex(index)
    setLightboxTitle(`${client.client_name} — Image #${index + 1}`)
    setLightboxOpen(true)
  }

  // Modal open helpers
  const openCreateModal = () => {
    setDetailClient(null)
    setName('')
    setPhone('')
    setEmail('')
    setContactPerson('')
    setAddress('')
    setCity('')
    setRemarks('')
    setStatusVal('published')
    setFiles([])
    setModalMode('create')
  }

  const openEditModal = (client: Client) => {
    setDetailClient(client)
    setName(client.client_name || '')
    setPhone(client.client_phone || '')
    setEmail(client.client_email || '')
    setContactPerson(client.client_contact_person || '')
    setAddress(client.client_address || '')
    setCity(client.client_city || '')
    setRemarks(client.client_remarks || '')
    setStatusVal(client.status || 'published')
    setFiles([])
    setModalMode('edit')
  }

  const openViewDrawer = (client: Client) => {
    setDetailClient(client)
    setDrawerOpen(true)
  }

  // Delete Mutation (Single)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await rdk.request(deleteItem('clients', id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client deleted successfully')
      setClientToDelete(null)
      if (drawerOpen && detailClient?.client_id === clientToDelete?.client_id) {
        setDrawerOpen(false)
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete client')
    },
  })

  // Bulk Delete Mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await rdk.request(deleteItems('clients', ids as any))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success(`Successfully deleted ${selectedClientIds.length} clients`)
      setSelectedClientIds([])
      setBulkDeleteModalOpen(false)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete selected clients')
    },
  })

  // Form Submit (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Client name is required')
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
        client_name: name.trim(),
        client_phone: phone.trim(),
        client_email: email.trim(),
        client_contact_person: contactPerson.trim(),
        client_address: address.trim(),
        client_city: city.trim(),
        client_remarks: remarks.trim(),
        status: statusVal,
      }

      if (uploadedIds.length > 0) {
        payload.client_images = uploadedIds
      }

      if (modalMode === 'create') {
        await rdk.request(createItem('clients', payload))
        toast.success('Client created successfully')
      } else if (modalMode === 'edit' && detailClient) {
        await rdk.request(updateItem('clients', detailClient.client_id, payload))
        toast.success('Client updated successfully')
      }

      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setModalMode(null)
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to save client')
    } finally {
      setIsSubmitting(false)
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </div>
              <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
                Clients Directory
              </h1>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {clients.length} Total
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your client database, primary contacts, addresses, and field attachments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
              title="Refresh clients"
            >
              <RefreshCw
                className={cn('size-3.5', isFetching && 'animate-spin text-primary')}
              />
              <span>Refresh</span>
            </Button>

            <Button
              size="sm"
              onClick={openCreateModal}
              className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Plus className="size-3.5" />
              <span>New Client</span>
            </Button>
          </div>
        </div>

        {/* 2. Toolbar: Bulk Selection Bar OR (Search + Filter + Sort + Refresh) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 bg-card shrink-0">
          {selectedClientIds.length > 0 ? (
            /* Bulk selection toolbar */
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={() => setSelectedClientIds([])}
                className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear selection"
              >
                <X className="size-3.5" />
              </button>
              <span className="text-[13px] font-medium text-primary">
                {selectedClientIds.length} clients selected
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
                  onClick={() => setSelectedClientIds([])}
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
                  {filteredAndSortedClients.length} {filteredAndSortedClients.length === 1 ? 'client' : 'clients'}
                </span>
              </div>

              {/* Search, Filter, Sort, Refresh */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] sm:w-64">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, phone, city..."
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
                      <p className="text-xs font-bold text-foreground">Filter Clients</p>
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

                    {/* Filter by City */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">City / Region</label>
                      <Select
                        value={filterCity}
                        onValueChange={(val) => {
                          setFilterCity(val)
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="All Cities" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          <SelectItem value="all">All Cities</SelectItem>
                          {uniqueCities.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filter by Phone */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Phone Number</label>
                      <Select
                        value={filterHasPhone}
                        onValueChange={(val) => {
                          setFilterHasPhone(val)
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Clients</SelectItem>
                          <SelectItem value="yes">With Phone Number</SelectItem>
                          <SelectItem value="no">Without Phone Number</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filter by Attached Photos */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Attached Photos</label>
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
                          <SelectItem value="all">All Clients</SelectItem>
                          <SelectItem value="yes">With Photos Only</SelectItem>
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
                      <ArrowUpDown className="size-3.5 text-muted-foreground" />
                      <span>Sort</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-1.5 shadow-lg">
                    <div className="p-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Sort Clients By
                    </div>
                    {[
                      { key: 'name asc', label: 'Client Name: A to Z' },
                      { key: 'name desc', label: 'Client Name: Z to A' },
                      { key: 'city asc', label: 'City: A to Z' },
                      { key: 'date desc', label: 'Date: Newest First' },
                      { key: 'date asc', label: 'Date: Oldest First' },
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
                  title="Refresh clients"
                >
                  <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin text-primary')} />
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
                      filteredAndSortedClients.length > 0 &&
                      selectedClientIds.length === filteredAndSortedClients.length
                    }
                    onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  />
                </th>

                {/* Client Name */}
                <th
                  onClick={() => handleSortToggle('name')}
                  style={{ width: colWidths.name, minWidth: colWidths.name }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>CLIENT NAME</span>
                    {sortSelected.startsWith('name') ? (
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
                    isResizing={isResizing === 'name'}
                    onMouseDown={(e) => startResizing('name', e)}
                  />
                </th>

                {/* Contact Person */}
                <th
                  style={{ width: colWidths.contact, minWidth: colWidths.contact }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                >
                  <span className="pr-2">CONTACT PERSON</span>
                  <ColumnResizer
                    isResizing={isResizing === 'contact'}
                    onMouseDown={(e) => startResizing('contact', e)}
                  />
                </th>

                {/* Phone & Email */}
                <th
                  style={{ width: colWidths.phone, minWidth: colWidths.phone }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                >
                  <span className="pr-2">PHONE & EMAIL</span>
                  <ColumnResizer
                    isResizing={isResizing === 'phone'}
                    onMouseDown={(e) => startResizing('phone', e)}
                  />
                </th>

                {/* Location / City */}
                <th
                  onClick={() => handleSortToggle('city')}
                  style={{ width: colWidths.city, minWidth: colWidths.city }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>LOCATION / CITY</span>
                    {sortSelected.startsWith('city') ? (
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
                    isResizing={isResizing === 'city'}
                    onMouseDown={(e) => startResizing('city', e)}
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
                      <p className="text-sm font-medium">Loading client directory...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Building2 className="size-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium">No clients found</p>
                      <p className="text-xs text-muted-foreground">
                        Try modifying your search criteria or register a new client.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const isChecked = selectedClientIds.includes(String(client.client_id))
                  const imgCount = Array.isArray(client.client_images) ? client.client_images.length : 0

                  return (
                    <tr
                      key={client.client_id}
                      onClick={() => openViewDrawer(client)}
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
                          handleToggleSelectOne(String(client.client_id))
                        }}
                      >
                        <Checkbox checked={isChecked} />
                      </td>

                      {/* Client Name */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Building2 className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{client.client_name}</p>
                            {client.client_remarks && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                                {client.client_remarks}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact Person */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        {client.client_contact_person ? (
                          <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <User className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{client.client_contact_person}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Phone & Email */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {client.client_phone && (
                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                              <Phone className="size-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{client.client_phone}</span>
                            </span>
                          )}
                          {client.client_email && (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="size-3 shrink-0" />
                              <span className="truncate">{client.client_email}</span>
                            </span>
                          )}
                          {!client.client_phone && !client.client_email && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>

                      {/* Location / City */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex flex-col gap-0.5 text-xs max-w-[200px]">
                          {client.client_city ? (
                            <span className="font-medium text-foreground flex items-center gap-1">
                              <MapPin className="size-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{client.client_city}</span>
                            </span>
                          ) : null}
                          {client.client_address && (
                            <span className="text-muted-foreground truncate" title={client.client_address}>
                              {client.client_address}
                            </span>
                          )}
                          {!client.client_city && !client.client_address && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>

                      {/* Attached Photos */}
                      <td className="py-2.5 px-3 text-center border-b border-r border-gray-200 dark:border-border">
                        {imgCount > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openClientLightbox(client, 0)
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                            title="View photos in lightbox"
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
                            onClick={() => openViewDrawer(client)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="View Client Details"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(client)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit Client"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setClientToDelete(client)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                            title="Delete Client"
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
            <span>per page &middot; {filteredAndSortedClients.length} clients</span>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="icon"
                className="size-6 cursor-pointer"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-6 cursor-pointer"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="size-3" />
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      {/* --- Slide-Over View Client Drawer (Radix Sheet) --- */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col bg-card">
          {detailClient && (
            <>
              {/* Drawer Header */}
              <SheetHeader className="p-5 border-b border-border bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary shrink-0 border border-border">
                      <Building2 className="size-6" />
                    </div>
                    <div className="min-w-0">
                      <SheetTitle className="text-base font-bold text-foreground truncate">
                        {detailClient.client_name}
                      </SheetTitle>
                      <SheetDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                        {detailClient.client_city || 'Client Location'} &middot; Added {detailClient.date_created ? new Date(detailClient.date_created).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
                      </SheetDescription>
                    </div>
                  </div>

                  <div className="mr-8 shrink-0">
                    {(detailClient.status || 'published').toLowerCase() === 'draft' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 border border-slate-500/20">
                        Draft
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </SheetHeader>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                {/* Contact Card */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    Contact Information
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Contact Person</span>
                      <span className="font-semibold text-foreground mt-0.5 inline-block">
                        {detailClient.client_contact_person || 'Not specified'}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Phone</span>
                      <span className="font-semibold text-foreground mt-0.5 inline-block">
                        {detailClient.client_phone || 'Not specified'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-muted-foreground block text-[11px]">Email</span>
                      <span className="font-semibold text-foreground mt-0.5 inline-block truncate">
                        {detailClient.client_email || 'Not specified'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Address Card */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    Address & Location
                  </p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">City / Region</span>
                      <span className="font-semibold text-foreground mt-0.5 inline-block">
                        {detailClient.client_city || 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Full Street Address</span>
                      <p className="bg-muted/30 p-2.5 rounded-lg text-foreground leading-relaxed mt-0.5">
                        {detailClient.client_address || 'No street address provided.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Remarks Card */}
                {detailClient.client_remarks && (
                  <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      Remarks / Notes
                    </p>
                    <p className="bg-muted/30 p-2.5 rounded-lg text-foreground leading-relaxed">
                      {detailClient.client_remarks}
                    </p>
                  </div>
                )}

                {/* Attached Images */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      Attached Client Photos
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {Array.isArray(detailClient.client_images) ? detailClient.client_images.length : 0} file(s)
                    </span>
                  </div>

                  {Array.isArray(detailClient.client_images) && detailClient.client_images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {detailClient.client_images.map((img: any, i: number) => {
                        const fileUrl = `${ATTENDANCE_SERVER_URL || API_URL}/assets/${img.directus_files_id || img.id}`
                        return (
                          <div
                            key={i}
                            onClick={() => openClientLightbox(detailClient, i)}
                            className="group/img relative rounded-lg border border-border overflow-hidden bg-muted/20 hover:border-primary/50 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                          >
                            <div className="relative overflow-hidden aspect-video bg-muted/30">
                              <img
                                src={fileUrl}
                                alt={`Client Photo ${i + 1}`}
                                className="w-full h-full object-cover transition-transform group-hover/img:scale-105"
                                onError={(e) => {
                                  ;(e.target as HTMLElement).style.display = 'none'
                                }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 flex items-center justify-center transition-all opacity-0 group-hover/img:opacity-100">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/75 text-white text-[11px] font-medium backdrop-blur-xs shadow-xs">
                                  <ZoomIn className="size-3.5" />
                                  Preview
                                </span>
                              </div>
                            </div>
                            <div className="p-1.5 flex items-center justify-between bg-card border-t border-border">
                              <span className="text-[10px] font-medium truncate">Photo #{i + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-primary cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openClientLightbox(detailClient, i)
                                }}
                                title="Open in Lightbox"
                              >
                                <Maximize2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground">
                      <Paperclip className="size-5 mx-auto mb-1 opacity-40" />
                      <p className="text-xs">No photos attached for this client.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-border bg-card flex items-center gap-2">
                <Button
                  onClick={() => {
                    setDrawerOpen(false)
                    openEditModal(detailClient)
                  }}
                  className="flex-1 h-8 text-xs font-medium cursor-pointer gap-1.5"
                >
                  <Pencil className="size-3.5" />
                  Edit Client Details
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setClientToDelete(detailClient)
                  }}
                  className="h-8 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer gap-1.5 px-3"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* --- Create / Edit Sheet --- */}
      <Sheet
        open={modalMode === 'create' || modalMode === 'edit'}
        onOpenChange={(open) => !open && setModalMode(null)}
      >
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col bg-background">
          <div className="p-5 border-b border-border bg-muted/20">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {modalMode === 'create' ? 'Add New Client' : 'Edit Client Details'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {modalMode === 'create'
                ? 'Fill in the information to register a new client.'
                : 'Modify the details and contact points for this client.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
            {/* Name */}
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Client / Company Name <span className="text-rose-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                className="h-8 text-xs"
                required
              />
            </div>

            {/* Contact Person & Phone */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                  Contact Person
                </label>
                <Input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                  Phone Number
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Email & City */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                  City / Region
                </label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Mumbai, Jaipur"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Status
              </label>
              <Select value={statusVal} onValueChange={setStatusVal}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Active / Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Full Address */}
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Full Street Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                placeholder="Street address, building, landmarks..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-xs shadow-2xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Remarks / Purpose
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Key requirements or notes..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-xs shadow-2xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* File Upload Dropzone */}
            <FileDropzone
              files={files}
              onChange={setFiles}
              label="Attach Photos / Documents"
              description="PNG, JPG, or PDF documents up to 10MB"
              accept="image/*,.pdf"
              multiple
              onPreviewImage={(url, name) => {
                setLightboxImages([url])
                setLightboxIndex(0)
                setLightboxTitle(name || 'Attachment Preview')
                setLightboxOpen(true)
              }}
            />

            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalMode(null)}
                className="h-8 text-xs cursor-pointer px-3"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8 text-xs font-semibold cursor-pointer gap-1.5 px-3"
              >
                {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                {modalMode === 'create' ? 'Add Client' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* --- Delete Confirmation AlertDialog (Single) --- */}
      <AlertDialog
        open={Boolean(clientToDelete)}
        onOpenChange={(open) => !open && setClientToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="size-5" />
              <AlertDialogTitle>Delete Client?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong className="text-foreground">
                "{clientToDelete?.client_name}"
              </strong>
              ? All associated visits and notes may lose their reference. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (clientToDelete) {
                  deleteMutation.mutate(clientToDelete.client_id)
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Client'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- Bulk Delete AlertDialog --- */}
      <AlertDialog
        open={bulkDeleteModalOpen}
        onOpenChange={setBulkDeleteModalOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="size-5" />
              <AlertDialogTitle>Delete Selected Clients?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong className="text-foreground">
                {selectedClientIds.length} selected clients
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkDeleteMutation.mutate(selectedClientIds)
              }}
              disabled={bulkDeleteMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {bulkDeleteMutation.isPending
                ? 'Deleting...'
                : `Delete ${selectedClientIds.length} Clients`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- Image Lightbox for Client Photos --- */}
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
