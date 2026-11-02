import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StepPasswordProps {
  password: string
  setPassword: (val: string) => void
  confirmPassword: string
  setConfirmPassword: (val: string) => void
  onSubmit: () => void
  busy?: boolean
}

export default function StepPassword({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  onSubmit,
  busy = false,
}: StepPasswordProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const isPasswordValid = password.length >= 6
  const isMatch = password === confirmPassword
  const isValid = isPasswordValid && isMatch

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 flex flex-col items-start">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-[#11213f] mb-2">
          <Lock className="h-4 w-4" />
        </div>
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-[#11213f]">
          Set your password
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose a strong password to secure your account.
        </p>
      </div>

      <div className="space-y-4">
        {/* Password Input */}
        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm font-semibold text-foreground"
          >
            Password
          </label>
          <div className="relative flex items-center">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="Enter password"
              className="w-full rounded-xl border border-input bg-card pl-4 pr-10 py-2.5 text-sm outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Confirm Password Input */}
        <div className="space-y-1">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-semibold text-foreground"
          >
            Confirm Password
          </label>
          <div className="relative flex items-center">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full rounded-xl border border-input bg-card pl-4 pr-10 py-2.5 text-sm outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {password && confirmPassword && !isMatch && (
          <p className="text-xs text-rose-600">Passwords do not match.</p>
        )}
        {password && password.length < 6 && (
          <p className="text-xs text-muted-foreground">
            Password should be at least 6 characters long.
          </p>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <Button
          onClick={onSubmit}
          disabled={!isValid || busy}
          className="w-full btn-3d bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
        >
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </div>
    </div>
  )
}
