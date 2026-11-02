// Mock Server for in-browser simulation of database & API operations.
// Intercepts window.fetch and simulates responses using localStorage state.

if (typeof window !== 'undefined') {
  // Initialize mock state in localStorage if it doesn't exist
  const MOCK_DB_KEY = 'mh.mock.db'

  // Standard Initial Data
  const INITIAL_DB = {
    me: {
      id: 'u-1',
      phone: '9876543210',
      name: 'Admin User',
      email: 'admin@myhisaab.com',
      title: 'Administrator',
      timezone: 'Asia/Kolkata',
      workingHours: '9:00 AM - 6:00 PM',
      avatar: '',
    },
    workspaces: [
      {
        id: 'ws-1',
        name: 'MyHisaab Payroll',
        role: 'owner',
        plan: 'pro',
        logo: '',
        slug: 'myhisaab',
      },
    ],
    members: [
      {
        id: 'm-1',
        userId: 'u-1',
        name: 'Admin User',
        phone: '9876543210',
        role: 'owner',
        status: 'Active',
      },
      {
        id: 'm-2',
        userId: 'u-2',
        name: 'Rahul Sharma',
        phone: '9876543211',
        role: 'admin',
        status: 'Active',
      },
      {
        id: 'm-3',
        userId: 'u-3',
        name: 'Pooja Patel',
        phone: '9876543212',
        role: 'member',
        status: 'Active',
      },
    ],
    roles: {
      resources: [
        { key: 'employees', label: 'Employees Directory' },
        { key: 'attendance', label: 'Attendance & Roster' },
        { key: 'payroll', label: 'Payroll Processing' },
        { key: 'leave', label: 'Leave Requests' },
        { key: 'crm', label: 'CRM & Pipeline' },
        { key: 'tasks', label: 'Tasks Manager' },
        { key: 'assets', label: 'IT Assets' },
      ],
      actions: ['view', 'manage'],
      builtin: [
        { name: 'owner', permissions: { employees: ['view', 'manage'], attendance: ['view', 'manage'], payroll: ['view', 'manage'], leave: ['view', 'manage'], crm: ['view', 'manage'], tasks: ['view', 'manage'], assets: ['view', 'manage'] }, isSystem: true },
        { name: 'admin', permissions: { employees: ['view', 'manage'], attendance: ['view', 'manage'], payroll: ['view'], leave: ['view', 'manage'], crm: ['view', 'manage'], tasks: ['view', 'manage'], assets: ['view', 'manage'] }, isSystem: true },
        { name: 'member', permissions: { employees: ['view'], attendance: ['view'], leave: ['view'], tasks: ['view', 'manage'] }, isSystem: true },
      ],
      custom: [],
    },
    employees: [
      {
        id: 'emp-1',
        empCode: 'MH-001',
        name: 'Amit Patel',
        email: 'amit.patel@myhisaab.com',
        phone: '9811122233',
        department: 'Engineering',
        role: 'Senior Software Engineer',
        gender: 'man',
        managerId: null,
        managerUserId: null,
        managerName: '',
        shiftId: 'shift-1',
        status: 'Active',
        joinedDate: '2024-01-15',
        monthlyCtc: 12000000, // 1,20,000 INR in paise
        payBasis: 'monthly',
        trackingEnabled: true,
      },
      {
        id: 'emp-2',
        empCode: 'MH-002',
        name: 'Neha Gupta',
        email: 'neha.gupta@myhisaab.com',
        phone: '9822233344',
        department: 'Product',
        role: 'Product Manager',
        gender: 'woman',
        managerId: null,
        managerUserId: null,
        managerName: '',
        shiftId: 'shift-1',
        status: 'Active',
        joinedDate: '2024-03-01',
        monthlyCtc: 15000000, // 1,50,000 INR
        payBasis: 'monthly',
        trackingEnabled: false,
      },
      {
        id: 'emp-3',
        empCode: 'MH-003',
        name: 'Vikram Singh',
        email: 'vikram.singh@myhisaab.com',
        phone: '9833344455',
        department: 'Sales',
        role: 'Business Development Executive',
        gender: 'man',
        managerId: null,
        managerUserId: null,
        managerName: '',
        shiftId: 'shift-2',
        status: 'Active',
        joinedDate: '2024-05-10',
        monthlyCtc: 6000000, // 60,000 INR
        payBasis: 'monthly',
        trackingEnabled: true,
      },
      {
        id: 'emp-4',
        empCode: 'MH-004',
        name: 'Sneha Rao',
        email: 'sneha.rao@myhisaab.com',
        phone: '9844455566',
        department: 'HR',
        role: 'HR Specialist',
        gender: 'woman',
        managerId: null,
        managerUserId: null,
        managerName: '',
        shiftId: 'shift-1',
        status: 'Probation',
        joinedDate: '2025-02-01',
        monthlyCtc: 5000000, // 50,000 INR
        payBasis: 'monthly',
        trackingEnabled: false,
      },
      {
        id: 'emp-5',
        empCode: 'MH-005',
        name: 'Arjun Mehta',
        email: 'arjun.mehta@myhisaab.com',
        phone: '9855566677',
        department: 'Engineering',
        role: 'Junior Frontend Developer',
        gender: 'man',
        managerId: 'emp-1',
        managerUserId: 'u-4',
        managerName: 'Amit Patel',
        shiftId: 'shift-1',
        status: 'Active',
        joinedDate: '2024-08-01',
        monthlyCtc: 4500000, // 45,000 INR
        payBasis: 'monthly',
        trackingEnabled: false,
      },
    ],
    shifts: [
      {
        id: 'shift-1',
        name: 'Standard Morning',
        startTime: '09:00',
        endTime: '18:00',
        lateGraceMin: 15,
        earlyLeaveGraceMin: 15,
        halfDayAfterMin: 240,
        minFullDayMin: 480,
        minHalfDayMin: 240,
        isDefault: true,
      },
      {
        id: 'shift-2',
        name: 'Flexible Mid-Day',
        startTime: '11:00',
        endTime: '20:00',
        lateGraceMin: 30,
        earlyLeaveGraceMin: 15,
        halfDayAfterMin: 240,
        minFullDayMin: 480,
        minHalfDayMin: 240,
        isDefault: false,
      },
      {
        id: 'shift-3',
        name: 'Night Shift',
        startTime: '21:00',
        endTime: '06:00',
        lateGraceMin: 15,
        earlyLeaveGraceMin: 15,
        halfDayAfterMin: 240,
        minFullDayMin: 480,
        minHalfDayMin: 240,
        isDefault: false,
      },
    ],
    attendancePolicy: {
      workingDays: '1,2,3,4,5', // Mon-Fri
      latesForHalfDay: 3,
      latesForAbsent: 5,
      earlyLeavesForHalfDay: 3,
      earlyLeavesForAbsent: 5,
      countingPeriod: 'month',
    },
    attendance: {} as Record<string, Record<string, any>>,
    leaveTypes: [
      { id: 'lt-1', name: 'Sick Leave', code: 'SL', annualDays: 12, paid: true, color: '#ef4444', active: true },
      { id: 'lt-2', name: 'Casual Leave', code: 'CL', annualDays: 12, paid: true, color: '#f59e0b', active: true },
      { id: 'lt-3', name: 'Earned Leave', code: 'EL', annualDays: 18, paid: true, color: '#10b981', active: true },
      { id: 'lt-4', name: 'Maternity Leave', code: 'ML', annualDays: 90, paid: true, color: '#ec4899', active: true },
      { id: 'lt-5', name: 'Loss of Pay', code: 'LOP', annualDays: 0, paid: false, color: '#6b7280', active: true },
    ],
    leaveBalances: {} as Record<string, any[]>,
    leaveRequests: [
      {
        id: 'lr-1',
        employeeId: 'emp-4',
        employeeName: 'Sneha Rao',
        leaveTypeId: 'lt-2',
        typeName: 'Casual Leave',
        fromDate: '2026-07-20',
        toDate: '2026-07-21',
        days: 2,
        halfDay: false,
        status: 'pending',
        reason: 'Family function at hometown',
        createdAt: '2026-07-14T10:00:00Z',
      },
      {
        id: 'lr-2',
        employeeId: 'emp-3',
        employeeName: 'Vikram Singh',
        leaveTypeId: 'lt-1',
        typeName: 'Sick Leave',
        fromDate: '2026-07-10',
        toDate: '2026-07-10',
        days: 1,
        halfDay: false,
        status: 'approved',
        reason: 'Fever and cold',
        createdAt: '2026-07-09T08:30:00Z',
      },
    ],
    tasks: [
      { id: 't-1', title: 'Prepare Q3 Payroll Budget', description: 'Consolidate department budgets and CTC structures', status: 'in_progress', priority: 'high', assigneeId: 'emp-2', assigneeName: 'Neha Gupta', createdById: 'u-1', dueDate: '2026-07-25', completedAt: null, createdAt: '2026-07-10T12:00:00Z' },
      { id: 't-2', title: 'Verify statutory compliance documents', description: 'Review PF/ESI filings for the month', status: 'todo', priority: 'medium', assigneeId: 'emp-4', assigneeName: 'Sneha Rao', createdById: 'u-1', dueDate: '2026-07-28', completedAt: null, createdAt: '2026-07-11T09:00:00Z' },
      { id: 't-3', title: 'Onboard arjun to codebase', description: 'Help Junior developer set up environment', status: 'done', priority: 'low', assigneeId: 'emp-1', assigneeName: 'Amit Patel', createdById: 'u-1', dueDate: '2026-07-15', completedAt: '2026-07-15T15:30:00Z', createdAt: '2026-07-12T11:00:00Z' },
    ],
    taskComments: {} as Record<string, any[]>,
    crm: {
      companies: [
        { id: 'c-1', name: 'Acme Corp', industry: 'Software', website: 'acme.com', phone: '9998887771', ownerId: 'u-1', ownerName: 'Admin User', contactCount: 1, dealCount: 1, createdAt: '2026-06-01T12:00:00Z' },
        { id: 'c-2', name: 'Initech LLC', industry: 'Financial Services', website: 'initech.com', phone: '9998887772', ownerId: 'u-3', ownerName: 'Pooja Patel', contactCount: 1, dealCount: 0, createdAt: '2026-06-15T09:00:00Z' },
      ],
      contacts: [
        { id: 'ct-1', companyId: 'c-1', companyName: 'Acme Corp', name: 'John Doe', email: 'john@acme.com', phone: '988887771', title: 'VP Engineering', ownerId: 'u-1', ownerName: 'Admin User', createdAt: '2026-06-02T10:00:00Z' },
        { id: 'ct-2', companyId: 'c-2', companyName: 'Initech LLC', name: 'Peter Gibbons', email: 'peter@initech.com', phone: '988887772', title: 'Senior VP Operations', ownerId: 'u-3', ownerName: 'Pooja Patel', createdAt: '2026-06-16T11:00:00Z' },
      ],
      deals: [
        { id: 'd-1', title: 'Acme Enterprise License', companyId: 'c-1', companyName: 'Acme Corp', contactId: 'ct-1', contactName: 'John Doe', ownerId: 'u-1', ownerName: 'Admin User', stage: 'negotiation', valuePaise: 45000000, source: 'website', expectedClose: '2026-08-15', closedAt: null, createdAt: '2026-06-03T14:00:00Z' },
      ],
      activities: [] as any[],
    },
    assets: [
      { id: 'a-1', name: 'MacBook Pro M3', serialNumber: 'MBP16M3-9823', category: 'Laptop', status: 'allocated', allocatedToId: 'emp-1', allocatedToName: 'Amit Patel', allocatedDate: '2024-01-15' },
      { id: 'a-2', name: 'Dell UltraSharp 27"', serialNumber: 'DELL-U27-1122', category: 'Monitor', status: 'allocated', allocatedToId: 'emp-2', allocatedToName: 'Neha Gupta', allocatedDate: '2024-03-05' },
      { id: 'a-3', name: 'iPhone 15 Pro', serialNumber: 'IPH15P-3847', category: 'Mobile Phone', status: 'available', allocatedToId: null, allocatedToName: '', allocatedDate: null },
    ],
    documents: {
      templates: [
        { id: 't-1', name: 'Offer Letter Template', body: '# Offer Letter\n\nDear {{name}},\nWe are pleased to offer you the position of {{role}} in our {{department}} department...' },
        { id: 't-2', name: 'Relieving Certificate', body: '# Relieving Certificate\n\nThis is to certify that {{name}} was employed with us...' },
      ],
      generated: [
        { id: 'g-1', employeeId: 'emp-5', name: 'Arjun Mehta', templateId: 't-1', templateName: 'Offer Letter Template', title: 'Offer Letter - Arjun Mehta', body: '# Offer Letter\n\nDear Arjun Mehta,\nWe are pleased to offer you the position of Junior Frontend Developer...', createdAt: '2024-07-28T09:00:00Z' },
      ],
    },
    helpdesk: {
      tickets: [
        { id: 'tk-1', workspaceId: 'ws-1', subject: 'Payroll calculation error in PF', message: 'The PF calculation seems to miss the LOP deduction', status: 'open', response: '', createdById: 'emp-3', createdByName: 'Vikram Singh', createdAt: '2026-07-14T08:00:00Z' },
        { id: 'tk-2', workspaceId: 'ws-1', subject: 'MacBook heating issue', message: 'The laptop battery drains in 2 hours and gets hot', status: 'in_progress', response: 'Scheduled diagnostic checkup', createdById: 'emp-1', createdByName: 'Amit Patel', createdAt: '2026-07-13T10:00:00Z' },
      ],
      comments: {} as Record<string, any[]>,
    },
    hiring: {
      jobs: [
        { id: 'j-1', title: 'Senior Software Engineer (Node/React)', department: 'Engineering', location: 'Remote / Bengaluru', status: 'published', description: 'Requirements: 5+ years experience in Full Stack development...', salaryRange: '15-22 LPA', applicantsCount: 12, createdAt: '2026-06-20T10:00:00Z' },
        { id: 'j-2', title: 'Lead Product Designer', department: 'Product', location: 'Bengaluru', status: 'draft', description: 'Lead end-to-end design for payroll systems...', salaryRange: '18-25 LPA', applicantsCount: 0, createdAt: '2026-07-01T15:00:00Z' },
      ],
      applications: [
        { id: 'ap-1', jobId: 'j-1', jobTitle: 'Senior Software Engineer (Node/React)', name: 'Rohan Deshmukh', email: 'rohan.d@gmail.com', phone: '9888877701', resumeUrl: '', status: 'applied', expectedCtc: '18 LPA', experienceYears: 6, comments: 'Good background in React and microservices.', interviews: [] as any[], createdAt: '2026-07-02T10:00:00Z' },
        { id: 'ap-2', jobId: 'j-1', jobTitle: 'Senior Software Engineer (Node/React)', name: 'Kavita Iyer', email: 'kavita.i@outlook.com', phone: '9888877702', resumeUrl: '', status: 'interviewing', expectedCtc: '20 LPA', experienceYears: 7, comments: 'Strong backend skills, Express, PostgreSQL.', interviews: [{ id: 'iv-1', round: 'Technical Round 1', dateTime: '2026-07-16T11:00:00.000Z', interviewerName: 'Amit Patel', status: 'scheduled', feedback: '' }] as any[], createdAt: '2026-07-03T11:00:00Z' },
      ],
    },
    performance: {
      goals: [
        { id: 'g-1', employeeId: 'emp-1', employeeName: 'Amit Patel', title: 'Migrate server endpoints to clean architecture', targetDate: '2026-09-30', status: 'in_progress', weight: 40, progress: 65 },
        { id: 'g-2', employeeId: 'emp-1', employeeName: 'Amit Patel', title: 'Mentor arjun (junior dev)', targetDate: '2026-09-30', status: 'in_progress', weight: 20, progress: 90 },
      ],
      reviews: [
        { id: 'r-1', employeeId: 'emp-1', employeeName: 'Amit Patel', reviewerName: 'Neha Gupta', period: 'H1 2026', status: 'pending_employee', ratings: { performance: 4, compliance: 5 }, comments: 'Doing a great job with core architecture.', signedOffAt: null },
      ],
    },
    announcements: [
      { id: 'an-1', title: 'Welcome Arjun Mehta!', body: 'Please join us in welcoming Arjun Mehta, who has joined our Engineering team as Junior Frontend Developer today.', pinned: true, createdAt: '2024-08-01T09:00:00Z' },
      { id: 'an-2', title: 'H1 Payroll Freeze Schedule', body: 'All expense claims and roster updates must be completed by the 25th of this month for processing.', pinned: false, createdAt: '2026-07-12T10:00:00Z' },
    ],
    audit: [
      { id: 'au-1', action: 'Employee.Create', entity: 'Employee', entityId: 'emp-5', detail: 'Created employee Arjun Mehta', actorName: 'Admin User', createdAt: '2024-08-01T09:05:00Z' },
      { id: 'au-2', action: 'Attendance.Config.Update', entity: 'AttendanceConfig', entityId: 'config', detail: 'Updated late grace period parameters', actorName: 'Admin User', createdAt: '2026-07-15T12:00:00Z' },
    ],
    notifications: [
      { id: 'n-1', type: 'leave', title: 'Leave Applied', body: 'Sneha Rao has applied for Casual Leave on 2026-07-20.', link: '/admin/leave', read: false, createdAt: '2026-07-14T10:00:00Z' },
      { id: 'n-2', type: 'ticket', title: 'New Ticket Assigned', body: 'Support ticket "Payroll calculation error in PF" has been created.', link: '/admin/helpdesk', read: true, createdAt: '2026-07-14T08:05:00Z' },
    ],
    conversations: [
      { id: 'conv-1', kind: 'dm', title: 'Neha Gupta', otherUserId: 'u-2', participantCount: 2, lastMessage: 'Sure, I will review it by evening.', lastMessageAt: '2026-07-15T15:20:00Z', unreadCount: 1 },
      { id: 'conv-2', kind: 'group', title: 'Product Launch Group', otherUserId: null, participantCount: 4, lastMessage: 'Meeting link shared in calendar.', lastMessageAt: '2026-07-14T18:00:00Z', unreadCount: 0 },
    ] as any[],
    messages: {
      'conv-1': [
        { id: 'msg-1', senderId: 'u-1', senderName: 'Admin User', body: 'Hi Neha, did you get a chance to look at the budget proposal?', mine: true, createdAt: '2026-07-15T15:10:00Z' },
        { id: 'msg-2', senderId: 'u-2', senderName: 'Neha Gupta', body: 'Sure, I will review it by evening.', mine: false, createdAt: '2026-07-15T15:20:00Z' },
      ],
      'conv-2': [
        { id: 'msg-3', senderId: 'u-3', senderName: 'Pooja Patel', body: 'Is the checklist ready for the marketing release?', mine: false, createdAt: '2026-07-14T17:45:00Z' },
        { id: 'msg-4', senderId: 'u-2', senderName: 'Neha Gupta', body: 'Meeting link shared in calendar.', mine: false, createdAt: '2026-07-14T18:00:00Z' },
      ],
    } as Record<string, any[]>,
    advances: [
      { id: 'ad-1', employeeId: 'emp-3', employeeName: 'Vikram Singh', empCode: 'MH-003', kind: 'Salary Advance', principal: 1000000, rateBps: 0, tenureMonths: 2, startPeriod: '2026-07', note: 'Medical emergency', status: 'approved', monthlyEmi: 500000, balance: 1000000, payments: [] },
    ],
    adjustments: [] as any[],
    payrollRuns: [
      { id: 'pr-1', period: '2026-06', netPaise: 42000000, count: 5, status: 'Finalized', finalizedAt: '2026-07-01T10:00:00Z', payslipsCount: 5 },
    ],
    payslips: [
      { id: 'ps-1', employeeId: 'emp-1', empName: 'Amit Patel', designation: 'Senior Software Engineer', period: '2026-06', earnings: [{ componentCode: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 6000000 }, { componentCode: 'HRA', name: 'House Rent Allowance', type: 'earning', amount: 3000000 }, { componentCode: 'SA', name: 'Special Allowance', type: 'earning', amount: 3000000 }], deductions: [{ componentCode: 'PF', name: 'Provident Fund', type: 'deduction', amount: 180000 }, { componentCode: 'TDS', name: 'Income Tax', type: 'deduction', amount: 500000 }], reimbursements: [], employerContributions: [], grossSalary: 12000000, netSalary: 11320000, taxWithheld: 500000, checkDate: '2026-07-01' },
      { id: 'ps-2', employeeId: 'emp-2', empName: 'Neha Gupta', designation: 'Product Manager', period: '2026-06', earnings: [{ componentCode: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 7500000 }, { componentCode: 'HRA', name: 'House Rent Allowance', type: 'earning', amount: 3750000 }, { componentCode: 'SA', name: 'Special Allowance', type: 'earning', amount: 3750000 }], deductions: [{ componentCode: 'PF', name: 'Provident Fund', type: 'deduction', amount: 18000 }, { componentCode: 'TDS', name: 'Income Tax', type: 'deduction', amount: 800000 }], reimbursements: [], employerContributions: [], grossSalary: 15000000, netSalary: 14182000, taxWithheld: 800000, checkDate: '2026-07-01' },
    ] as any[],
    statutoryConfig: {
      pfEnabled: true,
      pfContributionRate: 12,
      pfEmployerContributionRate: 12,
      pfWageCeiling: 1500000, // 15,000 INR in paise
      esiEnabled: true,
      esiContributionRate: 0.75,
      esiEmployerContributionRate: 3.25,
      esiWageCeiling: 2100000, // 21,000 INR
      lwfEnabled: true,
      lwfEmployeeShare: 2000, // 20 INR
      lwfEmployerShare: 4000, // 40 INR
      tdsEnabled: true,
    },
    invoices: [
      { id: 'inv-billing-1', description: 'Enterprise Plan - Annual (Up to 500 Employees)', amountPaise: 4990000, status: 'paid', plan: 'annual_500', createdAt: '2026-01-01T10:00:00Z', paidAt: '2026-01-01T10:15:00Z' },
    ],
  }

  // Load state or write default
  const storedDb = localStorage.getItem(MOCK_DB_KEY)
  const db = storedDb ? JSON.parse(storedDb) : INITIAL_DB
  if (!storedDb) {
    try {
      const userStr = localStorage.getItem('mh.user')
      if (userStr) {
        const u = JSON.parse(userStr)
        if (u && u.id) {
          db.me.id = u.id
          db.me.name = u.name || db.me.name
          db.me.phone = u.phone || db.me.phone
          db.me.email = u.email || db.me.email
        }
      }
    } catch (e) {
      console.error('Failed to init mock db me from mh.user:', e)
    }
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db))
  }

  const saveDb = () => {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db))
  }

  // Helper to construct a Response object
  const makeResponse = (data: any, status = 200, ok = true) => {
    return new Response(JSON.stringify(data), {
      status,
      statusText: ok ? 'OK' : 'Error',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  // Intercept fetch calls
  const originalFetch = window.fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    
    // Only intercept requests directed to /api or /uploads
    if (!urlStr.startsWith('/api') && !urlStr.startsWith('/uploads')) {
      return originalFetch(input, init)
    }

    // Extract pathname and query params
    const parsedUrl = new URL(urlStr, window.location.origin)
    const pathname = parsedUrl.pathname
    const searchParams = parsedUrl.searchParams
    const method = init?.method?.toUpperCase() || 'GET'
    let body = null
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          body = JSON.parse(init.body)
        } catch {
          body = init.body
        }
      } else if (init.body instanceof FormData) {
        // file upload
        body = init.body
      }
    }

    // Logging for debugging in console
    console.debug(`[MOCK API] ${method} ${pathname}`, { params: Object.fromEntries(searchParams.entries()), body })

    try {
      // ─── AUTH ───
      if (pathname === '/api/auth/request-otp') {
        return makeResponse({ success: true })
      }
      if (pathname === '/api/auth/verify-otp') {
        const phone = body?.phone || '9876543210'
        return makeResponse({
          token: 'mock-jwt-token-xyz123',
          user: {
            id: db.me.id,
            phone,
            name: db.me.name,
            email: db.me.email,
            isSuperAdmin: true,
          },
          workspaces: db.workspaces,
        })
      }

      // ─── FILE UPLOADS ───
      if (pathname === '/api/uploads') {
        return makeResponse({
          key: 'mock-upload-key-123.jpg',
          url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256',
          provider: 'local',
        })
      }

      // ─── ME ───
      if (pathname === '/api/me') {
        if (method === 'GET') {
          try {
            const userStr = localStorage.getItem('mh.user')
            if (userStr) {
              const u = JSON.parse(userStr)
              if (u && u.id) {
                db.me.id = u.id
                db.me.name = u.name || db.me.name
                db.me.phone = u.phone || db.me.phone
                db.me.email = u.email || db.me.email
                saveDb()
              }
            }
          } catch (e) {
            console.error('Failed to sync mock db me on GET /api/me:', e)
          }
          return makeResponse(db.me)
        }
        if (method === 'PATCH') {
          Object.assign(db.me, body)
          saveDb()
          return makeResponse(db.me)
        }
      }

      // ─── WORKSPACES ───
      if (pathname === '/api/workspaces') {
        if (method === 'POST') {
          const ws = {
            id: `ws-${Date.now()}`,
            name: body?.name || 'New Workspace',
            role: 'owner',
            plan: 'pro',
            logo: '',
            slug: (body?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '-'),
          }
          db.workspaces.push(ws)
          saveDb()
          return makeResponse(ws)
        }
      }
      if (pathname.startsWith('/api/workspaces/')) {
        const parts = pathname.split('/')
        const wsId = parts[3]
        const action = parts[4]

        if (action === 'members') {
          const memberId = parts[5]
          if (method === 'GET') {
            return makeResponse(db.members)
          }
          if (method === 'POST') {
            const member = {
              id: `m-${Date.now()}`,
              userId: `u-${Date.now()}`,
              name: body?.name,
              phone: body?.phone,
              role: body?.role || 'member',
              status: 'Active',
            }
            db.members.push(member)
            saveDb()
            return makeResponse(member)
          }
          if (method === 'PATCH' && memberId) {
            const member = db.members.find((m: any) => m.id === memberId)
            if (member) {
              member.role = body?.role
              saveDb()
            }
            return makeResponse({ success: true })
          }
          if (method === 'DELETE' && memberId) {
            db.members = db.members.filter((m: any) => m.id !== memberId)
            saveDb()
            return makeResponse({ success: true })
          }
        }

        if (action === 'roles') {
          const roleId = parts[5]
          if (method === 'GET') {
            return makeResponse(db.roles)
          }
          if (method === 'POST') {
            const role = {
              id: `role-${Date.now()}`,
              name: body?.name,
              permissions: body?.permissions || {},
              isSystem: false,
            }
            db.roles.custom.push(role)
            saveDb()
            return makeResponse(role)
          }
          if (method === 'PUT' && roleId) {
            const role = db.roles.custom.find((r: any) => r.id === roleId)
            if (role) {
              if (body?.name) role.name = body.name
              if (body?.permissions) role.permissions = body.permissions
              saveDb()
            }
            return makeResponse({ success: true })
          }
          if (method === 'DELETE' && roleId) {
            db.roles.custom = db.roles.custom.filter((r: any) => r.id !== roleId)
            saveDb()
            return makeResponse({ success: true })
          }
        }

        if (action === 'my-permissions') {
          return makeResponse({
            role: 'owner',
            permissions: {
              employees: ['view', 'manage'],
              attendance: ['view', 'manage'],
              payroll: ['view', 'manage'],
              leave: ['view', 'manage'],
              crm: ['view', 'manage'],
              tasks: ['view', 'manage'],
              assets: ['view', 'manage'],
            },
          })
        }

        if (action === 'billing') {
          if (parts[5] === 'order') {
            return makeResponse({
              orderId: `order-${Date.now()}`,
              amount: 499000,
              currency: 'INR',
              keyId: 'rzp_test_mockkey',
              plan: body?.plan || 'per_member',
              basicSeats: body?.basicSeats || 0,
              proSeats: body?.proSeats || 0,
            })
          }
          if (parts[5] === 'verify') {
            const invoice = {
              id: `inv-${Date.now()}`,
              description: `Upgrade - ${body?.plan || 'Per Seat'}`,
              amountPaise: 499000,
              status: 'paid' as const,
              plan: body?.plan || 'per_member',
              createdAt: new Date().toISOString(),
              paidAt: new Date().toISOString(),
            }
            db.invoices.push(invoice)
            saveDb()
            return makeResponse({ ok: true, plan: body?.plan, extraSeats: 5, proSeats: 5 })
          }
          // Default: billing summary
          return makeResponse({
            plan: 'pro',
            liveTracking: true,
            employees: { used: db.employees.length, cap: 50 },
            members: { used: db.members.length, limit: 10 },
            seats: { basic: 5, pro: 5 },
            planExpiresAt: '2027-07-15T00:00:00Z',
            daysToExpiry: 365,
            perMemberPaise: 29900,
            proSeatPaise: 49900,
            annualPaise: 4990000,
            annualTiers: [
              { plan: 'annual_50', pricePaise: 990000, employeeCap: 50, label: 'Annual 50 employees' },
              { plan: 'annual_500', pricePaise: 4990000, employeeCap: 500, label: 'Annual 500 employees' },
            ],
          })
        }

        if (action === 'invoices') {
          const invoiceId = parts[5]
          if (parts[6] === 'pay') {
            const invoice = db.invoices.find((i: any) => i.id === invoiceId)
            if (invoice) {
              invoice.status = 'paid'
              invoice.paidAt = new Date().toISOString()
              saveDb()
            }
            return makeResponse({ orderId: `order-${Date.now()}`, amount: 499000, currency: 'INR', keyId: 'mock-key', plan: 'pro' })
          }
          return makeResponse(db.invoices)
        }

        // PATCH workspace metadata
        if (method === 'PATCH') {
          const ws = db.workspaces.find((w: any) => w.id === wsId)
          if (ws) {
            Object.assign(ws, body)
            saveDb()
          }
          return makeResponse(ws || db.workspaces[0])
        }
      }

      // ─── EMPLOYEES ───
      if (pathname === '/api/employees') {
        if (method === 'GET') {
          return makeResponse(db.employees)
        }
        if (method === 'POST') {
          const emp = {
            id: `emp-${Date.now()}`,
            empCode: `MH-0${db.employees.length + 1}`,
            name: body?.name || 'New employee',
            email: '',
            phone: '',
            department: body?.department || 'Unassigned',
            role: 'Associate',
            gender: '',
            managerId: null,
            managerUserId: null,
            managerName: '',
            shiftId: null,
            status: body?.status || 'Probation',
            joinedDate: new Date().toISOString().split('T')[0],
            monthlyCtc: 3000000, // 30k default
            payBasis: 'monthly',
            trackingEnabled: false,
          }
          db.employees.push(emp)
          saveDb()
          return makeResponse(emp)
        }
      }
      if (pathname.startsWith('/api/employees/')) {
        const parts = pathname.split('/')
        const empId = parts[3]
        const subAction = parts[4]

        if (subAction === 'salary') {
          const emp = db.employees.find((e: any) => e.id === empId)
          if (emp) {
            emp.monthlyCtc = body?.amount
            emp.payBasis = body?.basis || 'monthly'
            saveDb()
          }
          return makeResponse(emp)
        }

        const empIndex = db.employees.findIndex((e: any) => e.id === empId)
        if (method === 'PATCH' && empIndex !== -1) {
          const patch = body || {}
          const mappedPatch: any = {}
          for (const k in patch) {
            if (k === 'joinedDate') mappedPatch.joinedDate = patch[k]
            else if (k === 'joined') mappedPatch.joinedDate = patch[k]
            else mappedPatch[k] = patch[k]
          }

          if (mappedPatch.managerId) {
            const manager = db.employees.find((e: any) => e.id === mappedPatch.managerId)
            mappedPatch.managerName = manager ? manager.name : ''
          }

          Object.assign(db.employees[empIndex], mappedPatch)
          saveDb()
          return makeResponse(db.employees[empIndex])
        }
        if (method === 'DELETE' && empIndex !== -1) {
          db.employees.splice(empIndex, 1)
          saveDb()
          return makeResponse({ success: true })
        }
      }

      // ─── DASHBOARD STATS ───
      if (pathname === '/api/dashboard/stats') {
        const payrollSum = db.employees.reduce((acc: number, e: any) => acc + (e.monthlyCtc || 0), 0)
        const avgSal = db.employees.length ? Math.round(payrollSum / db.employees.length) : 0
        const activeCount = db.employees.filter((e: any) => e.status === 'Active').length

        const byDept = db.employees.reduce((acc: any[], e: any) => {
          const found = acc.find((x) => x.department === e.department)
          if (found) {
            found.count++
            found.costPaise += e.monthlyCtc || 0
          } else {
            acc.push({ department: e.department || 'Unassigned', count: 1, costPaise: e.monthlyCtc || 0 })
          }
          return acc
        }, [])

        const statusCounts = db.employees.reduce((acc: any[], e: any) => {
          const found = acc.find((x) => x.status === e.status)
          if (found) found.count++
          else acc.push({ status: e.status, count: 1 })
          return acc
        }, [])

        const topSalaries = [...db.employees]
          .sort((a, b) => b.monthlyCtc - a.monthlyCtc)
          .slice(0, 5)
          .map((e) => ({
            name: e.name,
            gender: e.gender,
            department: e.department,
            status: e.status,
            paise: e.monthlyCtc,
          }))

        return makeResponse({
          employees: db.employees.length,
          activeEmployees: activeCount,
          presentToday: Math.round(db.employees.length * 0.9),
          attendanceRatePct: 90,
          monthlyPayrollPaise: payrollSum,
          avgSalaryPaise: avgSal,
          maxSalary: topSalaries[0] ? { name: topSalaries[0].name, paise: topSalaries[0].paise } : null,
          avgTenureMonths: 14.5,
          byDepartment: byDept,
          statusCounts,
          topSalaries,
          payrollTrend: [
            { period: '2026-01', netPaise: payrollSum * 0.9 },
            { period: '2026-02', netPaise: payrollSum * 0.92 },
            { period: '2026-03', netPaise: payrollSum * 0.95 },
            { period: '2026-04', netPaise: payrollSum * 0.98 },
            { period: '2026-05', netPaise: payrollSum * 0.99 },
            { period: '2026-06', netPaise: payrollSum },
          ],
          pendingApprovals: db.leaveRequests
            .filter((lr: any) => lr.status === 'pending')
            .map((lr: any) => ({
              name: lr.employeeName,
              gender: 'man',
              kind: 'Leave',
              detail: `${lr.typeName} for ${lr.days} days`,
              paise: null,
            })),
        })
      }

      // ─── ATTENDANCE CONFIG ───
      if (pathname === '/api/attendance/config') {
        if (method === 'GET') {
          return makeResponse({ shifts: db.shifts, policy: db.attendancePolicy })
        }
        if (method === 'PUT') {
          if (body?.shifts) db.shifts = body.shifts
          if (body?.policy) db.attendancePolicy = body.policy
          saveDb()
          return makeResponse({ shifts: db.shifts, policy: db.attendancePolicy })
        }
      }

      // ─── ATTENDANCE REGISTERS ───
      if (pathname === '/api/attendance/day') {
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
        if (!db.attendance[date]) {
          db.attendance[date] = {}
        }
        const dailyRecord = db.attendance[date]

        const subjects = db.employees.map((e: any) => {
          let record = dailyRecord[e.id]
          if (!record) {
            record = {
              status: 'present',
              shiftId: e.shiftId || 'shift-1',
              checkIn: '09:02',
              checkOut: '18:05',
              late: false,
              earlyOut: false,
              source: 'biometric',
              sessions: [{ type: 'work', in: '09:02', out: '18:05', shiftId: e.shiftId || 'shift-1' }],
              workedMin: 543,
              breakMin: 0,
            }
            dailyRecord[e.id] = record
          }
          return {
            kind: 'employee',
            id: e.id,
            employeeId: e.id,
            name: e.name,
            gender: e.gender || '',
            avatar: '',
            subtitle: e.role,
            department: e.department,
            shiftId: e.shiftId || 'shift-1',
            rosterShiftId: e.shiftId || 'shift-1',
            rosterWeekOff: false,
            record,
          }
        })

        return makeResponse({
          date,
          subjects,
          shifts: db.shifts,
          policy: db.attendancePolicy,
        })
      }
      if (pathname === '/api/attendance/mark') {
        const date = body?.date
        const entries = body?.entries || []
        if (date && entries.length) {
          if (!db.attendance[date]) db.attendance[date] = {}
          const daily = db.attendance[date]

          for (const entry of entries) {
            const id = entry.employeeId || entry.userId
            if (!id) continue
            if (entry.status === 'clear') {
              delete daily[id]
            } else {
              daily[id] = {
                status: entry.status,
                shiftId: entry.shiftId || 'shift-1',
                checkIn: entry.sessions?.[0]?.in || null,
                checkOut: entry.sessions?.[0]?.out || null,
                late: entry.late || false,
                earlyOut: entry.earlyOut || false,
                source: 'admin-manual',
                sessions: entry.sessions || [],
                workedMin: entry.sessions ? 480 : 0,
                breakMin: 0,
              }
            }
          }
          saveDb()
        }
        return makeResponse({ marked: entries.length })
      }

      // ─── ROSTER ───
      if (pathname === '/api/roster') {
        const from = searchParams.get('from') || '2026-07-15'
        const to = searchParams.get('to') || '2026-07-21'

        const dates: string[] = []
        let current = new Date(from)
        const end = new Date(to)
        while (current <= end) {
          dates.push(current.toISOString().split('T')[0])
          current.setDate(current.getDate() + 1)
        }

        const rows = db.employees.map((e: any) => {
          const cells = dates.map((d) => {
            const dayOfWeek = new Date(d).getDay()
            const isWeekOff = !db.attendancePolicy.workingDays.includes(String(dayOfWeek))
            const daily = db.attendance[d]
            const dayRecord = daily ? daily[e.id] : null
            
            return {
              date: d,
              shiftId: dayRecord?.shiftId || e.shiftId || 'shift-1',
              source: dayRecord ? 'assignment' : (isWeekOff ? 'default' : 'assignment'),
              isWeekOff,
              isHoliday: false,
            }
          })

          return {
            employeeId: e.id,
            name: e.name,
            gender: e.gender || '',
            department: e.department,
            role: e.role,
            cells,
          }
        })

        return makeResponse({
          from,
          to,
          dates,
          shifts: db.shifts,
          rows,
          assignments: [],
          rotations: [],
          patterns: [],
        })
      }
      if (pathname === '/api/roster/cells') {
        const cells = body?.cells || []
        for (const input of cells) {
          const d = input.date
          const empId = input.employeeId
          if (!d || !empId) continue
          if (!db.attendance[d]) db.attendance[d] = {}
          
          if (input.clear) {
            delete db.attendance[d][empId]
          } else {
            if (!db.attendance[d][empId]) {
              db.attendance[d][empId] = {
                status: input.off ? 'weekoff' : 'present',
                shiftId: input.shiftId || 'shift-1',
                checkIn: null,
                checkOut: null,
                late: false,
                earlyOut: false,
                source: 'roster-assign',
                sessions: [],
                workedMin: 0,
                breakMin: 0,
              }
            } else {
              db.attendance[d][empId].shiftId = input.shiftId || db.attendance[d][empId].shiftId
              if (input.off) db.attendance[d][empId].status = 'weekoff'
            }
          }
        }
        saveDb()
        return makeResponse({ updated: cells.length })
      }
      if (pathname === '/api/roster/copy-week') {
        return makeResponse({ updated: 10 })
      }

      // Helper function to map a mock database advance to the LoanRow format expected by the frontend
      const mapAdvanceToLoan = (a: any): any => {
        const principal = a.principal || 0
        const tenure = a.tenureMonths || 1
        const rateBps = a.rateBps || 0
        const installment = a.installment || a.monthlyEmi || Math.round(principal / tenure)
        const outstanding = a.outstanding !== undefined ? a.outstanding : (a.balance !== undefined ? a.balance : principal)
        const totalPayable = a.totalPayable || principal

        // Generate installments list
        const installments: any[] = []
        if (a.installments && a.installments.length > 0) {
          installments.push(...a.installments)
        } else {
          let currentPeriod = a.startPeriod || '2026-08'
          let remaining = outstanding
          for (let seq = 1; seq <= tenure; seq++) {
            const amt = seq === tenure ? remaining : Math.min(installment, remaining)
            if (amt <= 0) break
            installments.push({
              id: `${a.id}-inst-${seq}`,
              period: currentPeriod,
              seq,
              principalPart: amt,
              interestPart: 0,
              amount: amt,
              status: outstanding === 0 ? 'recovered' : (seq === 1 ? 'scheduled' : 'pending')
            })
            const [y, m] = currentPeriod.split('-').map(Number)
            const nextM = m === 12 ? 1 : m + 1
            const nextY = m === 12 ? y + 1 : y
            currentPeriod = `${nextY}-${String(nextM).padStart(2, '0')}`
          }
        }

        return {
          id: a.id,
          employeeId: a.employeeId,
          employeeName: a.employeeName || 'Unknown',
          kind: a.kind || 'Advance',
          principal,
          interestType: a.interestType || 'none',
          rateBps,
          tenureMonths: tenure,
          installment,
          startPeriod: a.startPeriod || '2026-08',
          totalPayable,
          outstanding,
          status: a.status === 'approved' || a.status === 'active' ? 'active' : a.status,
          installments
        }
      }

      // ─── PAYROLL ───
      if (pathname === '/api/payroll/preview') {
        const period = searchParams.get('period') || '2026-07'
        const run = db.payrollRuns.find((r: any) => r.period === period)
        const locked = !!run

        const finalizedIds = run
          ? db.payslips.filter((p: any) => p.period === period).map((p: any) => p.employeeId)
          : []

        const slips = db.employees.map((e: any) => {
          const existing = db.payslips.find((p: any) => p.employeeId === e.id && p.period === period)
          if (existing) {
            return {
              employeeId: e.id,
              empName: e.name,
              designation: e.role || '',
              totalDays: existing.totalDays || 30,
              paidDays: existing.paidDays || 30,
              lopDays: existing.lopDays || 0,
              gross: existing.grossSalary,
              deductions: existing.grossSalary - existing.netSalary,
              employerContrib: existing.employerCost || 0,
              net: existing.netSalary,
              lines: [
                ...existing.earnings.map((l: any) => ({ ...l, type: 'earning' })),
                ...existing.deductions.map((l: any) => ({ ...l, type: 'deduction' })),
                ...(existing.reimbursements || []).map((l: any) => ({ ...l, type: 'reimbursement' })),
                ...(existing.employerContributions || []).map((l: any) => ({ ...l, type: 'employer_contribution' }))
              ],
              warnings: []
            }
          }

          const basic = Math.round(e.monthlyCtc * 0.5)
          const hra = Math.round(e.monthlyCtc * 0.25)
          const sa = e.monthlyCtc - basic - hra
          const pf = Math.min(180000, Math.round(basic * 0.12))
          const tds = Math.round(e.monthlyCtc * 0.05)

          const earnings = [
            { componentCode: 'BASIC', name: 'Basic Salary', type: 'earning', amount: basic },
            { componentCode: 'HRA', name: 'House Rent Allowance', type: 'earning', amount: hra },
            { componentCode: 'SA', name: 'Special Allowance', type: 'earning', amount: sa },
          ]
          const deductionsList = [
            { componentCode: 'PF', name: 'Provident Fund', type: 'deduction', amount: pf },
            { componentCode: 'TDS', name: 'Income Tax', type: 'deduction', amount: tds },
          ]

          const employeeAdjustments = (db.adjustments || []).filter((a: any) => a.employeeId === e.id && a.period === period)
          let extraEarnings = 0
          let extraDeductions = 0
          employeeAdjustments.forEach((adj: any) => {
            if (adj.type === 'earning') {
              extraEarnings += adj.amount
              earnings.push({ componentCode: 'ADJ', name: adj.label, type: 'earning', amount: adj.amount })
            } else {
              extraDeductions += adj.amount
              deductionsList.push({ componentCode: 'ADJ', name: adj.label, type: 'deduction', amount: adj.amount })
            }
          })

          const employeeAdvances = (db.advances || []).filter((a: any) => a.employeeId === e.id && (a.status === 'active' || a.status === 'approved'))
          let advanceDeduction = 0
          employeeAdvances.forEach((adv: any) => {
            const outstanding = adv.outstanding !== undefined ? adv.outstanding : (adv.balance !== undefined ? adv.balance : adv.principal)
            if (outstanding > 0) {
              const installment = adv.installment || adv.monthlyEmi || Math.round(adv.principal / (adv.tenureMonths || 3))
              const recovery = Math.min(installment, outstanding)
              advanceDeduction += recovery
              deductionsList.push({ componentCode: 'ADV', name: `Advance Recovery (${adv.kind || 'Advance'})`, type: 'deduction', amount: recovery })
            }
          })

          const gross = e.monthlyCtc + extraEarnings
          const totalDeductions = pf + tds + extraDeductions + advanceDeduction
          const net = Math.max(0, gross - totalDeductions)

          return {
            employeeId: e.id,
            empName: e.name,
            designation: e.role || '',
            totalDays: 30,
            paidDays: 30,
            lopDays: 0,
            gross,
            deductions: totalDeductions,
            employerContrib: 0,
            net,
            lines: [
              ...earnings.map(l => ({ ...l, type: 'earning' as const })),
              ...deductionsList.map(l => ({ ...l, type: 'deduction' as const }))
            ],
            warnings: []
          }
        })

        const totals = slips.reduce(
          (acc: any, slip: any) => {
            acc.gross += slip.gross
            acc.deductions += slip.deductions
            acc.net += slip.net
            acc.employerCost += slip.employerContrib
            return acc
          },
          { gross: 0, deductions: 0, net: 0, employerCost: 0, count: slips.length }
        )

        return makeResponse({
          period,
          totalDays: 30,
          locked,
          finalizedIds,
          slips,
          totals
        })
      }
      if (pathname === '/api/payroll/finalize') {
        const period = body?.period || '2026-07'
        const employeeIds = body?.employeeIds || []

        let run = db.payrollRuns.find((r: any) => r.period === period)
        if (!run) {
          run = {
            id: `run-${Date.now()}`,
            period,
            grossTotal: 0,
            deductionTotal: 0,
            netTotal: 0,
            employerCost: 0,
            status: 'Finalized',
            lockedAt: new Date().toISOString(),
            executedAt: new Date().toISOString(),
            payslipsCount: 0,
          }
          db.payrollRuns.push(run)
        }

        const targets = employeeIds.length > 0 
          ? db.employees.filter((e: any) => employeeIds.includes(e.id))
          : db.employees

        targets.forEach((e: any) => {
          const existingIndex = db.payslips.findIndex((p: any) => p.employeeId === e.id && p.period === period)
          if (existingIndex >= 0) return

          const basic = Math.round(e.monthlyCtc * 0.5)
          const hra = Math.round(e.monthlyCtc * 0.25)
          const sa = e.monthlyCtc - basic - hra
          const pf = Math.min(180000, Math.round(basic * 0.12))
          const tds = Math.round(e.monthlyCtc * 0.05)

          const earnings = [
            { componentCode: 'BASIC', name: 'Basic Salary', type: 'earning', amount: basic },
            { componentCode: 'HRA', name: 'House Rent Allowance', type: 'earning', amount: hra },
            { componentCode: 'SA', name: 'Special Allowance', type: 'earning', amount: sa },
          ]
          const deductions = [
            { componentCode: 'PF', name: 'Provident Fund', type: 'deduction', amount: pf },
            { componentCode: 'TDS', name: 'Income Tax', type: 'deduction', amount: tds },
          ]

          const employeeAdjustments = (db.adjustments || []).filter((a: any) => a.employeeId === e.id && a.period === period)
          let extraEarnings = 0
          let extraDeductions = 0
          employeeAdjustments.forEach((adj: any) => {
            if (adj.type === 'earning') {
              extraEarnings += adj.amount
              earnings.push({ componentCode: 'ADJ', name: adj.label, type: 'earning', amount: adj.amount })
            } else {
              extraDeductions += adj.amount
              deductions.push({ componentCode: 'ADJ', name: adj.label, type: 'deduction', amount: adj.amount })
            }
          })

          const employeeAdvances = (db.advances || []).filter((a: any) => a.employeeId === e.id && (a.status === 'active' || a.status === 'approved'))
          let advanceDeduction = 0
          employeeAdvances.forEach((adv: any) => {
            let outstanding = adv.outstanding !== undefined ? adv.outstanding : (adv.balance !== undefined ? adv.balance : adv.principal)
            if (outstanding > 0) {
              const installment = adv.installment || adv.monthlyEmi || Math.round(adv.principal / (adv.tenureMonths || 3))
              const recovery = Math.min(installment, outstanding)
              advanceDeduction += recovery
              deductions.push({ componentCode: 'ADV', name: `Advance Recovery (${adv.kind || 'Advance'})`, type: 'deduction', amount: recovery })

              if (adv.outstanding !== undefined) {
                adv.outstanding -= recovery
                if (adv.outstanding <= 0) adv.status = 'closed'
              }
              if (adv.balance !== undefined) {
                adv.balance -= recovery
                if (adv.balance <= 0) adv.status = 'closed'
              }

              if (adv.installments) {
                const inst = adv.installments.find((ins: any) => ins.period === period)
                if (inst) inst.status = 'recovered'
              }
            }
          })

          const grossSalary = e.monthlyCtc + extraEarnings
          const totalDeductions = pf + tds + extraDeductions + advanceDeduction
          const netSalary = Math.max(0, grossSalary - totalDeductions)

          db.payslips.push({
            id: `ps-${e.id}-${period}`,
            employeeId: e.id,
            empName: e.name,
            designation: e.role || '',
            period,
            earnings,
            deductions,
            reimbursements: [],
            employerContributions: [],
            grossSalary,
            netSalary,
            taxWithheld: tds,
            checkDate: new Date().toISOString().split('T')[0],
          })

          run.grossTotal += grossSalary
          run.deductionTotal += totalDeductions
          run.netTotal += netSalary
        })

        run.payslipsCount = db.payslips.filter((p: any) => p.period === period).length

        saveDb()
        return makeResponse({ ok: true, count: targets.length })
      }
      if (pathname === '/api/payroll/runs') {
        const mappedRuns = db.payrollRuns.map((r: any) => ({
          id: r.id,
          period: r.period,
          status: r.status || 'Finalized',
          grossTotal: r.grossTotal || r.grossPaise || 45000000,
          deductionTotal: r.deductionTotal || r.deductionPaise || 3000000,
          netTotal: r.netTotal || r.netPaise || 42000000,
          employerCost: r.employerCost || 0,
          lockedAt: r.lockedAt || r.finalizedAt || new Date().toISOString(),
          executedAt: r.executedAt || r.finalizedAt || new Date().toISOString(),
          _count: { payslips: r.payslipsCount || r.count || 0 }
        }))
        return makeResponse(mappedRuns)
      }
      if (pathname.startsWith('/api/payroll/runs/')) {
        const runId = pathname.split('/')[4]
        const r = db.payrollRuns.find((x: any) => x.id === runId)
        if (!r) return makeResponse({ error: 'Run not found' }, 404, false)
        const runPayslips = db.payslips.filter((p: any) => p.period === r.period)
        const mappedRun = {
          id: r.id,
          period: r.period,
          status: r.status || 'Finalized',
          grossTotal: r.grossTotal || r.grossPaise || 45000000,
          deductionTotal: r.deductionTotal || r.deductionPaise || 3000000,
          netTotal: r.netTotal || r.netPaise || 42000000,
          employerCost: r.employerCost || 0,
          lockedAt: r.lockedAt || r.finalizedAt || new Date().toISOString(),
          executedAt: r.executedAt || r.finalizedAt || new Date().toISOString(),
          _count: { payslips: runPayslips.length },
          payslips: runPayslips.map((p: any) => ({
            id: p.id,
            period: p.period,
            empName: p.empName,
            designation: p.designation || '',
            totalDays: p.totalDays || 30,
            paidDays: p.paidDays || 30,
            lopDays: p.lopDays || 0,
            gross: p.grossSalary,
            deductions: p.grossSalary - p.netSalary,
            employerContrib: p.employerCost || 0,
            net: p.netSalary,
            lines: [
              ...p.earnings.map((l: any) => ({ ...l, type: 'earning' })),
              ...p.deductions.map((l: any) => ({ ...l, type: 'deduction' })),
              ...(p.reimbursements || []).map((l: any) => ({ ...l, type: 'reimbursement' })),
              ...(p.employerContributions || []).map((l: any) => ({ ...l, type: 'employer_contribution' }))
            ]
          }))
        }
        return makeResponse(mappedRun)
      }
      if (pathname.startsWith('/api/payroll/payslips/')) {
        const parts = pathname.split('/')
        const psId = parts[4]
        const action = parts[5]

        if (action === 'pdf') {
          return new Response(new Blob(['Mock PDF Content'], { type: 'application/pdf' }), {
            status: 200,
            headers: { 'Content-Type': 'application/pdf' }
          })
        }

        const payslip = db.payslips.find((p: any) => p.id === psId) || db.payslips[0]
        const mappedPayslip = {
          id: payslip.id,
          period: payslip.period,
          empName: payslip.empName,
          designation: payslip.designation || '',
          totalDays: payslip.totalDays || 30,
          paidDays: payslip.paidDays || 30,
          lopDays: payslip.lopDays || 0,
          gross: payslip.grossSalary,
          deductions: payslip.grossSalary - payslip.netSalary,
          employerContrib: payslip.employerCost || 0,
          net: payslip.netSalary,
          lines: [
            ...payslip.earnings.map((l: any) => ({ ...l, type: 'earning' })),
            ...payslip.deductions.map((l: any) => ({ ...l, type: 'deduction' })),
            ...(payslip.reimbursements || []).map((l: any) => ({ ...l, type: 'reimbursement' })),
            ...(payslip.employerContributions || []).map((l: any) => ({ ...l, type: 'employer_contribution' }))
          ]
        }
        return makeResponse(mappedPayslip)
      }
      if (pathname === '/api/payroll/structures') {
        return makeResponse([
          { id: 'struct-1', name: 'Standard Structure', description: '50% Basic, 25% HRA, 25% Special Allowance', isDefault: true, lines: JSON.stringify([{ code: 'BASIC', name: 'Basic Salary', type: 'earning', calcType: 'percent_of_base', rateBps: 5000, prorateOnLop: true }, { code: 'HRA', name: 'House Rent Allowance', type: 'earning', calcType: 'percent_of_base', rateBps: 2500, prorateOnLop: true }]) },
        ])
      }
      if (pathname === '/api/payroll/config') {
        if (method === 'GET') return makeResponse(db.statutoryConfig)
        if (method === 'PUT') {
          Object.assign(db.statutoryConfig, body)
          saveDb()
          return makeResponse(db.statutoryConfig)
        }
      }
      if (pathname === '/api/payroll/adjustments') {
        if (method === 'GET') {
          return makeResponse(db.adjustments || [])
        }
        if (method === 'POST') {
          const adj = {
            id: `adj-${Date.now()}`,
            employeeId: body?.employeeId,
            period: body?.period,
            type: body?.type,
            label: body?.label,
            amount: body?.amount,
            isTaxable: true,
            note: '',
            payslipId: null
          }
          if (!db.adjustments) db.adjustments = []
          db.adjustments.push(adj)
          saveDb()
          return makeResponse(adj)
        }
      }
      if (pathname.startsWith('/api/payroll/adjustments/')) {
        const adjId = pathname.split('/')[4]
        if (method === 'DELETE') {
          if (db.adjustments) {
            db.adjustments = db.adjustments.filter((a: any) => a.id !== adjId)
            saveDb()
          }
          return makeResponse({ success: true })
        }
      }

      // ─── ADVANCES ───
      if (pathname === '/api/advances') {
        if (method === 'GET') {
          return makeResponse((db.advances || []).map(mapAdvanceToLoan))
        }
        if (method === 'POST') {
          const emp = db.employees.find((e: any) => e.id === body?.employeeId)
          const adv = {
            id: `ad-${Date.now()}`,
            employeeId: body?.employeeId,
            employeeName: emp ? emp.name : 'Unknown',
            empCode: emp ? emp.empCode : 'N/A',
            kind: body?.kind || 'Salary Advance',
            principal: body?.principal || 100000,
            interestType: body?.interestType || 'none',
            rateBps: body?.rateBps || 0,
            tenureMonths: body?.tenureMonths || 3,
            startPeriod: body?.startPeriod || '2026-08',
            note: body?.note || '',
            status: 'active',
            installment: Math.round((body?.principal || 100000) / (body?.tenureMonths || 3)),
            outstanding: body?.principal || 100000,
            totalPayable: body?.principal || 100000,
          }
          if (!db.advances) db.advances = []
          db.advances.push(adv)
          saveDb()
          return makeResponse(mapAdvanceToLoan(adv))
        }
      }
      if (pathname.startsWith('/api/advances/')) {
        const advId = pathname.split('/')[3]
        const subAction = pathname.split('/')[4]
        
        const advIndex = db.advances.findIndex((a: any) => a.id === advId)
        if (advIndex !== -1) {
          if (subAction === 'close') {
            db.advances[advIndex].status = 'closed'
            db.advances[advIndex].outstanding = 0
            if (db.advances[advIndex].balance !== undefined) db.advances[advIndex].balance = 0
          } else if (method === 'DELETE') {
            db.advances.splice(advIndex, 1)
          }
          saveDb()
        }
        return makeResponse({ success: true })
      }

      // ─── PLATFORM SUPERADMIN ───
      if (pathname === '/api/superadmin/overview') {
        return makeResponse({
          totals: {
            workspaces: db.workspaces.length,
            users: db.members.length,
            employees: db.employees.length,
            revenuePaise: 4990000,
            paying: 1,
            byPlan: { pro: 1 },
          },
          workspaces: db.workspaces.map((w: any) => ({
            id: w.id,
            name: w.name,
            plan: w.plan,
            ownerName: 'Admin User',
            ownerPhone: '9876543210',
            ownerEmail: 'admin@myhisaab.com',
            employees: db.employees.length,
            members: db.members.length,
            employeeCap: 500,
            liveTracking: true,
            revenuePaise: 4990000,
            createdAt: '2026-01-01T10:00:00Z',
          })),
        })
      }
      if (pathname === '/api/superadmin/db-health') {
        return makeResponse({
          replicasConfigured: 2,
          autoscale: { activeReplicas: 2, baseReplicas: 2, maxDynamic: 4, perReplicaQps: 500, upThreshold: 80, downThreshold: 30, simulating: false },
          events: [],
          nodes: [
            { id: 'node-primary', role: 'primary', backing: 'live', dynamic: false, draining: false, status: 'healthy', reads: 45, writes: 20, total: 65, qps: 3.2, avgLatencyMs: 3.5, lastLatencyMs: 3.2 },
            { id: 'node-replica-1', role: 'replica', backing: 'live', dynamic: false, draining: false, status: 'healthy', reads: 120, writes: 0, total: 120, qps: 6.0, avgLatencyMs: 1.8, lastLatencyMs: 1.6 },
          ],
          totals: { reads: 165, writes: 20, qps: 9.2 },
        })
      }
      if (pathname === '/api/superadmin/queue-health') {
        return makeResponse({
          depth: 0,
          running: 0,
          workers: [{ id: 1, busy: false, type: null, done: 42 }],
          pool: { min: 1, max: 5, active: 1 },
          counters: { processed: 42, failed: 0, retried: 2, doneTotal: 42, failedTotal: 0 },
          jobsPerSec: 0,
          events: [],
          recent: [],
        })
      }
      if (pathname === '/api/superadmin/tickets') {
        return makeResponse(db.helpdesk.tickets)
      }
      if (pathname.startsWith('/api/superadmin/tickets/')) {
        const ticketId = pathname.split('/')[4]
        const ticket = db.helpdesk.tickets.find((t: any) => t.id === ticketId)
        if (ticket) {
          ticket.status = 'resolved'
          ticket.response = body?.response || 'Resolved'
          saveDb()
        }
        return makeResponse({ success: true })
      }
      if (pathname === '/api/support/tickets') {
        const tk = {
          id: `tk-${Date.now()}`,
          workspaceId: 'ws-1',
          subject: body?.subject || 'Support Ticket',
          message: body?.message || '',
          status: 'open',
          response: '',
          createdById: 'u-1',
          createdByName: 'Admin User',
          createdAt: new Date().toISOString(),
        }
        db.helpdesk.tickets.push(tk)
        saveDb()
        return makeResponse(tk)
      }

      // ─── ANNOUNCEMENTS ───
      if (pathname === '/api/announcements') {
        if (method === 'GET') return makeResponse(db.announcements)
        if (method === 'POST') {
          const ann = {
            id: `an-${Date.now()}`,
            title: body?.title || 'Notice',
            body: body?.body || '',
            pinned: body?.pinned || false,
            createdAt: new Date().toISOString(),
          }
          db.announcements.unshift(ann)
          saveDb()
          return makeResponse(ann)
        }
      }
      if (pathname.startsWith('/api/announcements/') && method === 'DELETE') {
        const annId = pathname.split('/')[3]
        db.announcements = db.announcements.filter((an: any) => an.id !== annId)
        saveDb()
        return makeResponse({ success: true })
      }

      // ─── AUDIT ───
      if (pathname === '/api/audit') {
        return makeResponse(db.audit)
      }

      // ─── NOTIFICATIONS ───
      if (pathname === '/api/notifications') {
        return makeResponse(db.notifications)
      }
      if (pathname === '/api/notifications/unread-count') {
        const count = db.notifications.filter((n: any) => !n.read).length
        return makeResponse({ count })
      }
      if (pathname === '/api/notifications/read-all') {
        db.notifications.forEach((n: any) => (n.read = true))
        saveDb()
        return makeResponse({ success: true })
      }
      if (pathname.startsWith('/api/notifications/')) {
        const nId = pathname.split('/')[3]
        const n = db.notifications.find((x: any) => x.id === nId)
        if (n) {
          n.read = true
          saveDb()
        }
        return makeResponse({ success: true })
      }

      // ─── MESSAGES ───
      if (pathname === '/api/messages/conversations') {
        return makeResponse(db.conversations)
      }
      if (pathname === '/api/messages/people') {
        return makeResponse(
          db.employees.map((e: any) => ({
            userId: e.id,
            name: e.name,
            phone: e.phone,
            role: e.role,
          }))
        )
      }
      if (pathname === '/api/messages/conversations/dm' || pathname === '/api/messages/conversations/dm-employee') {
        const otherId = body?.userId || body?.employeeId
        const existing = db.conversations.find((c: any) => c.otherUserId === otherId)
        if (existing) return makeResponse({ id: existing.id })
        
        const newConv = {
          id: `conv-${Date.now()}`,
          kind: 'dm' as const,
          title: db.employees.find((e: any) => e.id === otherId)?.name || 'Member',
          otherUserId: otherId,
          participantCount: 2,
          lastMessage: '',
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0,
        }
        db.conversations.push(newConv)
        db.messages[newConv.id] = []
        saveDb()
        return makeResponse({ id: newConv.id })
      }
      if (pathname.startsWith('/api/messages/conversations/')) {
        const convId = pathname.split('/')[4]
        const subAction = pathname.split('/')[5]

        if (subAction === 'messages') {
          if (method === 'GET') {
            return makeResponse(db.messages[convId] || [])
          }
          if (method === 'POST') {
            const msg = {
              id: `msg-${Date.now()}`,
              senderId: 'u-1',
              senderName: 'Admin User',
              body: body?.body || '',
              mine: true,
              createdAt: new Date().toISOString(),
            }
            if (!db.messages[convId]) db.messages[convId] = []
            db.messages[convId].push(msg)
            
            const conv = db.conversations.find((c: any) => c.id === convId)
            if (conv) {
              conv.lastMessage = msg.body
              conv.lastMessageAt = msg.createdAt
            }
            saveDb()
            return makeResponse({ id: msg.id, createdAt: msg.createdAt })
          }
        }
        if (subAction === 'read') {
          const conv = db.conversations.find((c: any) => c.id === convId)
          if (conv) {
            conv.unreadCount = 0
            saveDb()
          }
          return makeResponse({ success: true })
        }
      }

      // ─── NAV COUNTS ───
      if (pathname === '/api/dashboard/nav-counts') {
        const pendingLeaves = db.leaveRequests.filter((lr: any) => lr.status === 'pending').length
        return makeResponse({
          employees: db.employees.length,
          present: Math.round(db.employees.length * 0.9),
          pendingLeaves,
        })
      }

      // ─── HOLIDAYS ───
      if (pathname === '/api/holidays') {
        if (method === 'GET') {
          return makeResponse([
            { id: 'hol-1', date: '2026-01-26', name: 'Republic Day', type: 'national' },
            { id: 'hol-2', date: '2026-08-15', name: 'Independence Day', type: 'national' },
            { id: 'hol-3', date: '2026-10-02', name: 'Gandhi Jayanti', type: 'national' },
          ])
        }
        if (method === 'POST') {
          return makeResponse({ id: `hol-${Date.now()}`, date: body.date, name: body.name, type: body.type })
        }
      }
      if (pathname === '/api/holidays/upcoming') {
        return makeResponse([
          { id: 'hol-2', date: '2026-08-15', name: 'Independence Day', type: 'national' },
        ])
      }

      // ─── LEAVE ───
      if (pathname === '/api/leave/types') {
        return makeResponse(db.leaveTypes)
      }
      if (pathname === '/api/leave/balances') {
        return makeResponse([
          { id: 'bal-1', leaveTypeId: 'lt-1', year: 2026, allocated: 12, used: 2, available: 10, typeName: 'Sick Leave', code: 'SL', color: '#ef4444' },
          { id: 'bal-2', leaveTypeId: 'lt-2', year: 2026, allocated: 12, used: 1, available: 11, typeName: 'Casual Leave', code: 'CL', color: '#f59e0b' },
          { id: 'bal-3', leaveTypeId: 'lt-3', year: 2026, allocated: 18, used: 0, available: 18, typeName: 'Earned Leave', code: 'EL', color: '#10b981' },
        ])
      }
      if (pathname === '/api/leave/requests') {
        if (method === 'GET') {
          return makeResponse(db.leaveRequests)
        }
        if (method === 'POST') {
          const emp = db.employees.find((e: any) => e.id === body?.employeeId)
          const lt = db.leaveTypes.find((l: any) => l.id === body?.leaveTypeId)
          
          const from = new Date(body?.fromDate)
          const to = new Date(body?.toDate)
          const diffTime = Math.abs(to.getTime() - from.getTime())
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

          const request = {
            id: `lr-${Date.now()}`,
            employeeId: body?.employeeId,
            employeeName: emp ? emp.name : 'Unknown',
            leaveTypeId: body?.leaveTypeId,
            typeName: lt ? lt.name : 'Leave',
            fromDate: body?.fromDate,
            toDate: body?.toDate,
            days: body?.halfDay ? 0.5 : diffDays,
            halfDay: body?.halfDay || false,
            status: 'pending',
            reason: body?.reason || '',
            createdAt: new Date().toISOString(),
          }
          db.leaveRequests.unshift(request)
          saveDb()
          return makeResponse(request)
        }
      }
      if (pathname.startsWith('/api/leave/requests/')) {
        const lrId = pathname.split('/')[4]
        const action = pathname.split('/')[5]

        const req = db.leaveRequests.find((r: any) => r.id === lrId)
        if (req) {
          if (action === 'approve') req.status = 'approved'
          if (action === 'reject') req.status = 'rejected'
          saveDb()
        }
        return makeResponse({ success: true })
      }

      // ─── ONBOARDING ───
      if (pathname === '/api/onboarding') {
        return makeResponse({
          workspaceReady: true,
          employeesAdded: db.employees.length > 0,
          teamInvited: db.members.length > 1,
          payrollSetUp: true,
          payrollRun: db.payrollRuns.length > 0,
        })
      }

      // ─── TASKS ───
      if (pathname === '/api/tasks') {
        if (method === 'GET') {
          return makeResponse(db.tasks)
        }
        if (method === 'POST') {
          const assignee = db.employees.find((e: any) => e.id === body?.assigneeId)
          const task = {
            id: `t-${Date.now()}`,
            title: body?.title || 'New Task',
            description: body?.description || '',
            status: 'todo' as const,
            priority: body?.priority || 'medium',
            assigneeId: body?.assigneeId || null,
            assigneeName: assignee ? assignee.name : 'Unassigned',
            createdById: 'u-1',
            dueDate: body?.dueDate || new Date().toISOString().split('T')[0],
            completedAt: null,
            createdAt: new Date().toISOString(),
          }
          db.tasks.unshift(task)
          saveDb()
          return makeResponse(task)
        }
      }
      if (pathname === '/api/tasks/stats') {
        const stats = db.tasks.reduce(
          (acc: any, t: any) => {
            if (t.status === 'todo') acc.todo++
            else if (t.status === 'in_progress') acc.in_progress++
            else if (t.status === 'done') acc.done++
            return acc
          },
          { todo: 0, in_progress: 0, done: 0, overdue: 0 }
        )
        return makeResponse(stats)
      }
      if (pathname.startsWith('/api/tasks/')) {
        const parts = pathname.split('/')
        const tId = parts[3]
        const action = parts[4]

        if (action === 'comments') {
          if (method === 'GET') {
            return makeResponse(db.taskComments[tId] || [])
          }
          if (method === 'POST') {
            const comment = {
              id: `tc-${Date.now()}`,
              authorId: 'u-1',
              authorName: 'Admin User',
              body: body?.body || '',
              createdAt: new Date().toISOString(),
            }
            if (!db.taskComments[tId]) db.taskComments[tId] = []
            db.taskComments[tId].push(comment)
            saveDb()
            return makeResponse(comment)
          }
        }

        const taskIndex = db.tasks.findIndex((t: any) => t.id === tId)
        if (taskIndex !== -1) {
          if (method === 'PATCH') {
            const task = db.tasks[taskIndex]
            Object.assign(task, body)
            if (body.status === 'done' && !task.completedAt) {
              task.completedAt = new Date().toISOString()
            } else if (body.status && body.status !== 'done') {
              task.completedAt = null
            }
            if (body.assigneeId) {
              const assignee = db.employees.find((e: any) => e.id === body.assigneeId)
              task.assigneeName = assignee ? assignee.name : 'Unassigned'
            }
            saveDb()
            return makeResponse(task)
          }
          if (method === 'DELETE') {
            db.tasks.splice(taskIndex, 1)
            saveDb()
            return makeResponse({ success: true })
          }
        }
      }

      // ─── CRM COMPANIES ───
      if (pathname === '/api/crm/companies') {
        if (method === 'GET') return makeResponse(db.crm.companies)
        if (method === 'POST') {
          const comp = {
            id: `c-${Date.now()}`,
            name: body?.name || 'New Company',
            industry: body?.industry || '',
            website: body?.website || '',
            phone: body?.phone || '',
            ownerId: 'u-1',
            ownerName: 'Admin User',
            contactCount: 0,
            dealCount: 0,
            createdAt: new Date().toISOString(),
          }
          db.crm.companies.push(comp)
          saveDb()
          return makeResponse(comp)
        }
      }
      if (pathname.startsWith('/api/crm/companies/')) {
        const cId = pathname.split('/')[4]
        const idx = db.crm.companies.findIndex((c: any) => c.id === cId)
        if (idx !== -1) {
          if (method === 'PATCH') {
            Object.assign(db.crm.companies[idx], body)
            saveDb()
            return makeResponse(db.crm.companies[idx])
          }
          if (method === 'DELETE') {
            db.crm.companies.splice(idx, 1)
            saveDb()
            return makeResponse({ success: true })
          }
        }
      }

      // ─── CRM CONTACTS ───
      if (pathname === '/api/crm/contacts') {
        if (method === 'GET') return makeResponse(db.crm.contacts)
        if (method === 'POST') {
          const comp = db.crm.companies.find((c: any) => c.id === body?.companyId)
          const contact = {
            id: `ct-${Date.now()}`,
            companyId: body?.companyId || null,
            companyName: comp ? comp.name : '',
            name: body?.name || 'New Contact',
            email: body?.email || '',
            phone: body?.phone || '',
            title: body?.title || '',
            ownerId: 'u-1',
            ownerName: 'Admin User',
            createdAt: new Date().toISOString(),
          }
          db.crm.contacts.push(contact)
          if (comp) comp.contactCount++
          saveDb()
          return makeResponse(contact)
        }
      }
      if (pathname.startsWith('/api/crm/contacts/')) {
        const ctId = pathname.split('/')[4]
        const idx = db.crm.contacts.findIndex((c: any) => c.id === ctId)
        if (idx !== -1) {
          if (method === 'PATCH') {
            Object.assign(db.crm.contacts[idx], body)
            saveDb()
            return makeResponse(db.crm.contacts[idx])
          }
          if (method === 'DELETE') {
            db.crm.contacts.splice(idx, 1)
            saveDb()
            return makeResponse({ success: true })
          }
        }
      }

      // ─── CRM DEALS ───
      if (pathname === '/api/crm/deals') {
        if (method === 'GET') return makeResponse(db.crm.deals)
        if (method === 'POST') {
          const comp = db.crm.companies.find((c: any) => c.id === body?.companyId)
          const ct = db.crm.contacts.find((c: any) => c.id === body?.contactId)
          const deal = {
            id: `d-${Date.now()}`,
            title: body?.title || 'New Deal',
            companyId: body?.companyId || null,
            companyName: comp ? comp.name : '',
            contactId: body?.contactId || null,
            contactName: ct ? ct.name : '',
            ownerId: 'u-1',
            ownerName: 'Admin User',
            stage: body?.stage || 'new',
            valuePaise: body?.valuePaise || 0,
            source: body?.source || '',
            expectedClose: body?.expectedClose || new Date().toISOString().split('T')[0],
            closedAt: null,
            createdAt: new Date().toISOString(),
          }
          db.crm.deals.push(deal)
          if (comp) comp.dealCount++
          saveDb()
          return makeResponse(deal)
        }
      }
      if (pathname.startsWith('/api/crm/deals/')) {
        const dId = pathname.split('/')[4]
        const idx = db.crm.deals.findIndex((d: any) => d.id === dId)
        if (idx !== -1) {
          if (method === 'PATCH') {
            Object.assign(db.crm.deals[idx], body)
            if (body.stage === 'won' || body.stage === 'lost') {
              db.crm.deals[idx].closedAt = new Date().toISOString()
            } else {
              db.crm.deals[idx].closedAt = null
            }
            saveDb()
            return makeResponse(db.crm.deals[idx])
          }
          if (method === 'DELETE') {
            db.crm.deals.splice(idx, 1)
            saveDb()
            return makeResponse({ success: true })
          }
        }
      }
      if (pathname === '/api/crm/pipeline') {
        const stagesList = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const
        const stages = stagesList.map((stage) => {
          const stageDeals = db.crm.deals.filter((d: any) => d.stage === stage)
          const totalVal = stageDeals.reduce((sum: number, d: any) => sum + d.valuePaise, 0)
          return {
            stage,
            count: stageDeals.length,
            valuePaise: totalVal,
            deals: stageDeals,
          }
        })

        const totalCount = db.crm.deals.length
        const openDeals = db.crm.deals.filter((d: any) => d.stage !== 'won' && d.stage !== 'lost')
        const openValue = openDeals.reduce((sum: number, d: any) => sum + d.valuePaise, 0)
        const wonDeals = db.crm.deals.filter((d: any) => d.stage === 'won')
        const wonValue = wonDeals.reduce((sum: number, d: any) => sum + d.valuePaise, 0)

        return makeResponse({
          stages,
          summary: {
            openValuePaise: openValue,
            openCount: openDeals.length,
            wonValuePaise: wonValue,
            wonCount: wonDeals.length,
            totalCount,
          },
        })
      }
      if (pathname === '/api/crm/activities') {
        return makeResponse(db.crm.activities)
      }

      // ─── ASSETS ───
      if (pathname === '/api/assets') {
        if (method === 'GET') return makeResponse(db.assets)
        if (method === 'POST') {
          const asset = {
            id: `a-${Date.now()}`,
            name: body?.name || 'New Asset',
            serialNumber: body?.serialNumber || '',
            category: body?.category || 'Hardware',
            status: 'available',
            allocatedToId: null,
            allocatedToName: '',
            allocatedDate: null,
          }
          db.assets.push(asset)
          saveDb()
          return makeResponse(asset)
        }
      }
      if (pathname.startsWith('/api/assets/')) {
        const parts = pathname.split('/')
        const aId = parts[3]
        const action = parts[4]

        const idx = db.assets.findIndex((a: any) => a.id === aId)
        if (idx !== -1) {
          if (action === 'allocate') {
            const emp = db.employees.find((e: any) => e.id === body?.employeeId)
            db.assets[idx].status = 'allocated'
            db.assets[idx].allocatedToId = body?.employeeId
            db.assets[idx].allocatedToName = emp ? emp.name : 'Unknown'
            db.assets[idx].allocatedDate = new Date().toISOString().split('T')[0]
            saveDb()
            return makeResponse(db.assets[idx])
          }
          if (action === 'deallocate') {
            db.assets[idx].status = 'available'
            db.assets[idx].allocatedToId = null
            db.assets[idx].allocatedToName = ''
            db.assets[idx].allocatedDate = null
            saveDb()
            return makeResponse(db.assets[idx])
          }
          if (method === 'PATCH') {
            Object.assign(db.assets[idx], body)
            saveDb()
            return makeResponse(db.assets[idx])
          }
          if (method === 'DELETE') {
            db.assets.splice(idx, 1)
            saveDb()
            return makeResponse({ success: true })
          }
        }
      }

      // ─── DOCUMENTS ───
      if (pathname === '/api/documents/templates') {
        return makeResponse(db.documents.templates)
      }
      if (pathname === '/api/documents/generated') {
        if (method === 'GET') return makeResponse(db.documents.generated)
        if (method === 'POST') {
          const emp = db.employees.find((e: any) => e.id === body?.employeeId)
          const tmpl = db.documents.templates.find((t: any) => t.id === body?.templateId)
          
          let compiledBody = tmpl ? tmpl.body : ''
          if (emp) {
            compiledBody = compiledBody
              .replace(/\{\{name\}\}/g, emp.name)
              .replace(/\{\{role\}\}/g, emp.role)
              .replace(/\{\{department\}\}/g, emp.department)
          }

          const doc = {
            id: `g-${Date.now()}`,
            employeeId: body?.employeeId,
            name: emp ? emp.name : 'Unknown',
            templateId: body?.templateId,
            templateName: tmpl ? tmpl.name : 'Template',
            title: body?.title || `Generated Letter`,
            body: compiledBody,
            createdAt: new Date().toISOString(),
          }
          db.documents.generated.push(doc)
          saveDb()
          return makeResponse(doc)
        }
      }
      if (pathname.startsWith('/api/documents/generated/')) {
        const parts = pathname.split('/')
        const docId = parts[4]
        const action = parts[5]

        if (action === 'pdf') {
          return new Response(new Blob(['Mock PDF for Letter'], { type: 'application/pdf' }), {
            status: 200,
            headers: { 'Content-Type': 'application/pdf' }
          })
        }

        if (method === 'DELETE') {
          db.documents.generated = db.documents.generated.filter((g: any) => g.id !== docId)
          saveDb()
          return makeResponse({ success: true })
        }
      }

      // ─── HELPDESK ───
      if (pathname === '/api/helpdesk/tickets') {
        if (method === 'GET') return makeResponse(db.helpdesk.tickets)
        if (method === 'POST') {
          const tk = {
            id: `tk-${Date.now()}`,
            workspaceId: 'ws-1',
            subject: body?.subject || 'Ticket',
            message: body?.message || '',
            status: 'open',
            response: '',
            createdById: 'u-1',
            createdByName: 'Admin User',
            createdAt: new Date().toISOString(),
          }
          db.helpdesk.tickets.push(tk)
          saveDb()
          return makeResponse(tk)
        }
      }
      if (pathname.startsWith('/api/helpdesk/tickets/')) {
        const parts = pathname.split('/')
        const tkId = parts[4]
        const action = parts[5]

        if (action === 'comments') {
          if (method === 'GET') {
            return makeResponse(db.helpdesk.comments[tkId] || [])
          }
          if (method === 'POST') {
            const comment = {
              id: `hc-${Date.now()}`,
              authorId: 'u-1',
              authorName: 'Admin User',
              body: body?.body || '',
              createdAt: new Date().toISOString(),
            }
            if (!db.helpdesk.comments[tkId]) db.helpdesk.comments[tkId] = []
            db.helpdesk.comments[tkId].push(comment)
            saveDb()
            return makeResponse(comment)
          }
        }

        const idx = db.helpdesk.tickets.findIndex((t: any) => t.id === tkId)
        if (idx !== -1) {
          if (method === 'PATCH') {
            Object.assign(db.helpdesk.tickets[idx], body)
            saveDb()
            return makeResponse(db.helpdesk.tickets[idx])
          }
          if (method === 'DELETE') {
            db.helpdesk.tickets.splice(idx, 1)
            saveDb()
            return makeResponse({ success: true })
          }
        }
      }

      // ─── HIRING ───
      if (pathname === '/api/hiring/jobs') {
        if (method === 'GET') return makeResponse(db.hiring.jobs)
        if (method === 'POST') {
          const job = {
            id: `j-${Date.now()}`,
            title: body?.title || 'New Job Position',
            department: body?.department || 'Engineering',
            location: body?.location || 'Remote',
            status: 'published',
            description: body?.description || '',
            salaryRange: body?.salaryRange || '',
            applicantsCount: 0,
            createdAt: new Date().toISOString(),
          }
          db.hiring.jobs.push(job)
          saveDb()
          return makeResponse(job)
        }
      }
      if (pathname === '/api/hiring/applications') {
        return makeResponse(db.hiring.applications)
      }
      if (pathname.startsWith('/api/hiring/applications/')) {
        const parts = pathname.split('/')
        const apId = parts[4]
        const action = parts[5]

        const idx = db.hiring.applications.findIndex((a: any) => a.id === apId)
        if (idx !== -1) {
          if (action === 'status') {
            db.hiring.applications[idx].status = body?.status
            saveDb()
            return makeResponse({ success: true })
          }
          if (action === 'interviews') {
            const iv = {
              id: `iv-${Date.now()}`,
              round: body?.round || 'Technical',
              dateTime: body?.dateTime || new Date().toISOString(),
              interviewerName: body?.interviewerName || 'Amit Patel',
              status: 'scheduled',
              feedback: '',
            }
            if (!db.hiring.applications[idx].interviews) db.hiring.applications[idx].interviews = []
            db.hiring.applications[idx].interviews.push(iv)
            saveDb()
            return makeResponse(iv)
          }
        }
      }
      if (pathname.startsWith('/api/hiring/interviews/')) {
        const ivId = pathname.split('/')[4]
        const sub = pathname.split('/')[5]
        if (sub === 'feedback') {
          db.hiring.applications.forEach((ap: any) => {
            const iv = ap.interviews?.find((i: any) => i.id === ivId)
            if (iv) {
              iv.feedback = body?.feedback
              iv.status = 'completed'
            }
          })
          saveDb()
          return makeResponse({ success: true })
        }
      }

      // ─── PERFORMANCE ───
      if (pathname === '/api/performance/goals') {
        if (method === 'GET') return makeResponse(db.performance.goals)
        if (method === 'POST') {
          const emp = db.employees.find((e: any) => e.id === body?.employeeId)
          const goal = {
            id: `g-${Date.now()}`,
            employeeId: body?.employeeId,
            employeeName: emp ? emp.name : 'Unknown',
            title: body?.title || 'Key Performance Indicator',
            targetDate: body?.targetDate || new Date().toISOString().split('T')[0],
            status: 'in_progress',
            weight: body?.weight || 25,
            progress: body?.progress || 0,
          }
          db.performance.goals.push(goal)
          saveDb()
          return makeResponse(goal)
        }
      }
      if (pathname.startsWith('/api/performance/goals/')) {
        const goalId = pathname.split('/')[4]
        const idx = db.performance.goals.findIndex((g: any) => g.id === goalId)
        if (idx !== -1) {
          if (method === 'PATCH') {
            Object.assign(db.performance.goals[idx], body)
            saveDb()
            return makeResponse(db.performance.goals[idx])
          }
          if (method === 'DELETE') {
            db.performance.goals.splice(idx, 1)
            saveDb()
            return makeResponse({ success: true })
          }
        }
      }
      if (pathname === '/api/performance/reviews') {
        if (method === 'GET') return makeResponse(db.performance.reviews)
        if (method === 'POST') {
          const emp = db.employees.find((e: any) => e.id === body?.employeeId)
          const r = {
            id: `r-${Date.now()}`,
            employeeId: body?.employeeId,
            employeeName: emp ? emp.name : 'Unknown',
            reviewerName: 'Admin User',
            period: body?.period || 'Annual 2026',
            status: 'pending_employee',
            ratings: { performance: 0, compliance: 0 },
            comments: '',
            signedOffAt: null,
          }
          db.performance.reviews.push(r)
          saveDb()
          return makeResponse(r)
        }
      }
      if (pathname.startsWith('/api/performance/reviews/')) {
        const rId = pathname.split('/')[4]
        const action = pathname.split('/')[5]

        const idx = db.performance.reviews.findIndex((r: any) => r.id === rId)
        if (idx !== -1) {
          if (action === 'responses') {
            db.performance.reviews[idx].ratings = body?.ratings || { performance: 4, compliance: 4 }
            db.performance.reviews[idx].comments = body?.comments || ''
            db.performance.reviews[idx].status = 'pending_signoff'
            saveDb()
            return makeResponse({ success: true })
          }
          if (action === 'signoff') {
            db.performance.reviews[idx].signedOffAt = new Date().toISOString()
            db.performance.reviews[idx].status = 'completed'
            saveDb()
            return makeResponse({ success: true })
          }
        }
      }

      // ─── REPORTS ───
      if (pathname === '/api/reports/datasets') {
        return makeResponse([
          {
            key: 'payroll_summary',
            label: 'Payroll Financial Summary',
            ranged: 'period',
            fields: [
              { key: 'period', label: 'Period', type: 'text' },
              { key: 'employeeCount', label: 'Employee Count', type: 'number' },
              { key: 'grossEarning', label: 'Total Earnings', type: 'money' },
              { key: 'grossDeduction', label: 'Total Deductions', type: 'money' },
              { key: 'netSalary', label: 'Net Payout', type: 'money' },
            ],
          },
          {
            key: 'attendance_register',
            label: 'Attendance Register Report',
            ranged: 'date',
            fields: [
              { key: 'date', label: 'Date', type: 'date' },
              { key: 'employeeName', label: 'Employee Name', type: 'text' },
              { key: 'status', label: 'Status', type: 'enum', enum: ['present', 'absent', 'leave', 'weekoff', 'holiday'] },
              { key: 'workedMin', label: 'Minutes Worked', type: 'number' },
            ],
          },
        ])
      }
      if (pathname === '/api/reports/run') {
        const dataset = body?.dataset
        let reportColumns: any[] = []
        let reportRows: any[] = []

        if (dataset === 'payroll_summary') {
          reportColumns = [
            { key: 'period', label: 'Period', type: 'text' },
            { key: 'employeeCount', label: 'Employee Count', type: 'number' },
            { key: 'netSalary', label: 'Net Payout', type: 'money' },
          ]
          reportRows = [
            { period: '2026-06', employeeCount: db.employees.length, netSalary: 42000000 },
            { period: '2026-05', employeeCount: db.employees.length, netSalary: 41800000 },
          ]
        } else {
          reportColumns = [
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'employeeName', label: 'Employee Name', type: 'text' },
            { key: 'status', label: 'Status', type: 'text' },
          ]
          reportRows = db.employees.map((e: any) => ({
            date: new Date().toISOString().split('T')[0],
            employeeName: e.name,
            status: 'present',
          }))
        }

        return makeResponse({
          columns: reportColumns,
          rows: reportRows,
          total: reportRows.length,
          grouped: false,
        })
      }
      if (pathname === '/api/reports/saved') {
        return makeResponse([])
      }

      // ─── FIELD-STAFF LIVE TRACKING ───
      if (pathname === '/api/tracking/live') {
        const locations = db.employees
          .filter((e: any) => e.trackingEnabled)
          .map((e: any, index: number) => ({
            employeeId: e.id,
            name: e.name,
            department: e.department,
            lat: 12.9715987 + (index * 0.003 - 0.005),
            lng: 77.5945627 + (index * 0.002 - 0.003),
            batteryPct: 85 - index * 5,
            accuracyM: 10,
            recordedAt: new Date().toISOString(),
            lastSeenMinutes: 2,
            stale: false,
            source: 'ping',
          }))

        return makeResponse({
          staleMinutes: 15,
          locations,
        })
      }
      if (pathname === '/api/tracking/journey') {
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
        const employeeId = searchParams.get('employeeId')
        const emp = db.employees.find((e: any) => e.id === employeeId)
        
        return makeResponse({
          employeeId: employeeId || 'emp-1',
          name: emp ? emp.name : 'Amit Patel',
          department: emp ? emp.department : 'Engineering',
          date,
          distanceKm: 4.8,
          points: [
            { lat: 12.9715987, lng: 77.5945627, batteryPct: 90, accuracyM: 8, recordedAt: `${date}T09:15:00Z` },
            { lat: 12.9730000, lng: 77.5960000, batteryPct: 88, accuracyM: 10, recordedAt: `${date}T11:30:00Z` },
            { lat: 12.9750000, lng: 77.5980000, batteryPct: 82, accuracyM: 9, recordedAt: `${date}T14:45:00Z` },
            { lat: 12.9770000, lng: 77.6000000, batteryPct: 78, accuracyM: 10, recordedAt: `${date}T17:00:00Z` },
          ],
        })
      }

      console.warn(`[MOCK API] Fallback 404 for ${method} ${pathname}`)
      return makeResponse({ error: 'Endpoint mock not implemented' }, 404, false)

    } catch (err: any) {
      console.error(`[MOCK API ERROR] ${method} ${pathname}`, err)
      return makeResponse({ error: err.message || 'Internal Server Error' }, 500, false)
    }
  }
}
