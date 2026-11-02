import { useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import StepAccountType from './StepAccountType'
import StepDetails, { type SignupDetails } from './StepDetails'
import StepPassword from './StepPassword'

export interface SignupData {
  accountType: 'business' | 'employee'
  usedAppBefore: boolean
  firstName: string
  lastName: string
  companyCode?: string
  firmName?: string
  designation?: string
  employeeCount?: string
  password: string
}

interface SignupWizardProps {
  onClose: () => void
  onComplete: (data: SignupData) => void | Promise<void>
}

export default function SignupWizard({ onClose, onComplete }: SignupWizardProps) {
  const [step, setStep] = useState<number>(1)
  const [accountType, setAccountType] = useState<'business' | 'employee'>('business')
  const [usedAppBefore, setUsedAppBefore] = useState<boolean>(false)
  const [details, setDetails] = useState<SignupDetails>({
    firstName: '',
    lastName: '',
    companyCode: '',
    firmName: '',
    designation: '',
    employeeCount: '',
  })
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>('')

  const handleBack = () => {
    setError('')
    if (step === 3) {
      setStep(2)
    } else if (step === 2) {
      setStep(1)
    } else {
      onClose()
    }
  }

  const handleSubmit = async () => {
    setBusy(true)
    setError('')
    try {
      await onComplete({
        accountType,
        usedAppBefore,
        firstName: details.firstName,
        lastName: details.lastName,
        companyCode: details.companyCode,
        firmName: details.firmName,
        designation: details.designation,
        employeeCount: details.employeeCount,
        password,
      })
    } catch (err: any) {
      console.error('Registration submit error:', err)
      setError(err?.message || 'Registration failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const getProgressWidth = () => {
    if (step === 1) return 'w-1/3'
    if (step === 2) return 'w-2/3'
    return 'w-full'
  }

  return (
    <div className="w-full flex flex-col">
      {/* Wizard Header */}
      <div className="flex items-center justify-between pb-6">
        <button
          type="button"
          onClick={handleBack}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary/80 transition-colors cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>

        {/* Progress bar (3 steps) */}
        <div className="flex-1 mx-4 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full bg-[#2f63d8] rounded-full transition-all duration-300 ${getProgressWidth()}`}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary/80 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive text-center">
          {error}
        </div>
      )}

      {/* Step Panels */}
      <div className="w-full">
        {step === 1 && (
          <StepAccountType
            accountType={accountType}
            setAccountType={setAccountType}
            usedAppBefore={usedAppBefore}
            setUsedAppBefore={setUsedAppBefore}
            onNext={() => {
              setError('')
              setStep(2)
            }}
          />
        )}

        {step === 2 && (
          <StepDetails
            accountType={accountType}
            details={details}
            onChange={setDetails}
            onNext={() => {
              setError('')
              setStep(3)
            }}
          />
        )}

        {step === 3 && (
          <StepPassword
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            onSubmit={handleSubmit}
            busy={busy}
          />
        )}
      </div>
    </div>
  )
}
