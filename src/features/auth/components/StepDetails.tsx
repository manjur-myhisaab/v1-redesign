import { Button } from '@/components/ui/button'

export interface SignupDetails {
  firstName: string
  lastName: string
  companyCode?: string
  firmName?: string
  designation?: string
  employeeCount?: string
}

interface StepDetailsProps {
  accountType: 'business' | 'employee'
  details: SignupDetails
  onChange: (details: SignupDetails) => void
  onNext: () => void
}

export default function StepDetails({
  accountType,
  details,
  onChange,
  onNext,
}: StepDetailsProps) {
  const isEmployee = accountType === 'employee'

  const isValid = isEmployee
    ? details.firstName.trim().length > 0 &&
      (details.companyCode || '').trim().length > 0
    : details.firstName.trim().length > 0 &&
      (details.firmName || '').trim().length > 0 &&
      (details.designation || '').trim().length > 0 &&
      (details.employeeCount || '').trim().length > 0

  const handleFieldChange = (field: keyof SignupDetails, value: string) => {
    onChange({
      ...details,
      [field]: value,
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-[#11213f]">
          Enter your details
        </h1>
        <p className="text-sm text-muted-foreground">
          Please provide your information below.
        </p>
      </div>

      <div className="space-y-3.5">
        {/* Name Fields (Side by Side) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="firstName"
              className="block text-xs font-semibold text-foreground"
            >
              First Name <span className="text-destructive">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              value={details.firstName}
              onChange={(e) => handleFieldChange('firstName', e.target.value)}
              autoFocus
              placeholder="First name"
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="lastName"
              className="block text-xs font-semibold text-foreground"
            >
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              value={details.lastName}
              onChange={(e) => handleFieldChange('lastName', e.target.value)}
              placeholder="Last name"
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </div>
        </div>

        {isEmployee ? (
          /* Employee Field: Company Code */
          <div className="space-y-1">
            <label
              htmlFor="companyCode"
              className="block text-xs font-semibold text-foreground"
            >
              Company Code <span className="text-destructive">*</span>
            </label>
            <input
              id="companyCode"
              type="text"
              value={details.companyCode || ''}
              onChange={(e) => handleFieldChange('companyCode', e.target.value)}
              placeholder="Enter company code"
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </div>
        ) : (
          /* Business Fields: Firm Name, Designation, Employee Count */
          <>
            <div className="space-y-1">
              <label
                htmlFor="firmName"
                className="block text-xs font-semibold text-foreground"
              >
                Firm Name <span className="text-destructive">*</span>
              </label>
              <input
                id="firmName"
                type="text"
                value={details.firmName || ''}
                onChange={(e) => handleFieldChange('firmName', e.target.value)}
                placeholder="Enter firm name"
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/25"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="designation"
                className="block text-xs font-semibold text-foreground"
              >
                Designation <span className="text-destructive">*</span>
              </label>
              <input
                id="designation"
                type="text"
                value={details.designation || ''}
                onChange={(e) => handleFieldChange('designation', e.target.value)}
                placeholder="e.g. Director, Owner, HR"
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/25"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="employeeCount"
                className="block text-xs font-semibold text-foreground"
              >
                Employee Count <span className="text-destructive">*</span>
              </label>
              <input
                id="employeeCount"
                type="number"
                min="1"
                value={details.employeeCount || ''}
                onChange={(e) => handleFieldChange('employeeCount', e.target.value)}
                placeholder="e.g. 10"
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/25"
              />
            </div>
          </>
        )}
      </div>

      <div className="pt-2">
        <Button
          type="button"
          onClick={onNext}
          disabled={!isValid}
          className="w-full btn-3d bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

