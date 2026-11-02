import OtpInput from '@/components/ui/otp-input'

interface OtpInputFormProps {
  value: string
  onChange: (value: string) => void
  length: number
}

export default function OtpInputForm({ value, onChange, length }: OtpInputFormProps) {
  return (
    <div>
      <span className="block text-sm font-medium text-foreground">
        Verification code
      </span>
      <OtpInput
        value={value}
        onChange={onChange}
        length={length}
        autoFocus
        className="mt-1.5"
      />
    </div>
  )
}
