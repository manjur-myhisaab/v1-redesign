import { Contact, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StepAccountTypeProps {
  accountType: 'business' | 'employee'
  setAccountType: (type: 'business' | 'employee') => void
  usedAppBefore: boolean
  setUsedAppBefore: (val: boolean) => void
  onNext: () => void
}

export default function StepAccountType({
  accountType,
  setAccountType,
  usedAppBefore,
  setUsedAppBefore,
  onNext,
}: StepAccountTypeProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-[#11213f]">
          Create account
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose how you want to start.
        </p>
      </div>

      {/* Account Type Options */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Employee Option */}
        <div
          onClick={() => setAccountType('employee')}
          className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all cursor-pointer select-none min-h-[135px] text-center ${
            accountType === 'employee'
              ? 'border-[#2f63d8] bg-blue-50/20 dark:bg-blue-950/20 shadow-sm ring-1 ring-[#2f63d8]'
              : 'border-border bg-card hover:bg-secondary/40'
          }`}
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl mb-2.5 transition-colors ${
              accountType === 'employee'
                ? 'bg-[#cfe0fb] text-[#2f63d8] dark:bg-blue-900/40 dark:text-blue-300'
                : 'bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'
            }`}
          >
            <Contact className="h-5 w-5" />
          </div>
          <span className="font-semibold text-foreground text-sm">Employee</span>
          <span className="text-xs text-muted-foreground mt-0.5">Join your team</span>
        </div>

        {/* Business Option */}
        <div
          onClick={() => setAccountType('business')}
          className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all cursor-pointer select-none min-h-[135px] text-center ${
            accountType === 'business'
              ? 'border-[#2f63d8] bg-blue-50/20 dark:bg-blue-950/20 shadow-sm ring-1 ring-[#2f63d8]'
              : 'border-border bg-card hover:bg-secondary/40'
          }`}
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl mb-2.5 transition-colors ${
              accountType === 'business'
                ? 'bg-[#cfe0fb] text-[#2f63d8] dark:bg-blue-900/40 dark:text-blue-300'
                : 'bg-blue-50 text-[#2f63d8] dark:bg-blue-900/30 dark:text-blue-400'
            }`}
          >
            <Store className="h-5 w-5" />
          </div>
          <span className="font-semibold text-foreground text-sm">Business</span>
          <span className="text-xs text-muted-foreground mt-0.5">Create a workspace</span>
        </div>
      </div>

      {/* Checkbox Section */}
      <div className="flex items-start gap-2.5 px-1 py-1">
        <input
          type="checkbox"
          id="usedAppBefore"
          checked={usedAppBefore}
          onChange={(e) => setUsedAppBefore(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary/20 cursor-pointer"
        />
        <label
          htmlFor="usedAppBefore"
          className="text-xs text-muted-foreground leading-normal cursor-pointer select-none"
        >
          Have you ever used an app for attendance and payroll or first time user.
        </label>
      </div>

      {/* Action Button */}
      <div className="pt-2">
        <Button
          type="button"
          onClick={onNext}
          className="w-full btn-3d bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
