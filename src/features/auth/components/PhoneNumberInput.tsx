import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import OtpInputForm from './OtpInputForm'
import SignupWizard, { type SignupData } from './SignupWizard'
import { COUNTRIES, DEFAULT_COUNTRY } from '@/lib/countries'
import { useAuth, type SessionUser, type WorkspaceRef } from '@/context/auth/AuthContext'
import {
  checkNewUser,
  sendOtpViaSmsGateway,
  verifyAndLoginViaSmsGateway,
  login,
  getCurrentUser,
  createNewEmployee,
  createNewBusiness,
  formatPhoneAsEmail,
} from '@/services/server'
import { toast } from 'sonner'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import confetti from 'canvas-confetti'
import { isRoleAdmin } from '@/constants/roles'

const OTP_LENGTH = 6

function PhoneNumberInput() {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [iso, setIso] = useState(DEFAULT_COUNTRY.iso)
  const [phone, setPhone] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [step, setStep] = useState<'phone' | 'password' | 'otp' | 'signup_wizard'>('phone')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [timer, setTimer] = useState(30)

  // Timer countdown for OTP resend
  useEffect(() => {
    let interval: any = null
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1)
      }, 1000)
    } else {
      clearInterval(interval)
    }
    return () => clearInterval(interval)
  }, [step, timer])

  const country = COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY

  const phoneValid = phone.length >= country.minLen && phone.length <= country.maxLen
  const otpValid = otp.length === OTP_LENGTH

  const countryCode = country.dial.replace(/\D/g, '')
  const rawPhone = phone.replace(/\D/g, '')
  const digitsOnly =
    rawPhone.startsWith(countryCode) && rawPhone.length > countryCode.length + 8
      ? rawPhone
      : `${countryCode}${rawPhone}`

  const handleCountryChange = (nextIso: string) => {
    setIso(nextIso)
    const next = COUNTRIES.find((c) => c.iso === nextIso) ?? DEFAULT_COUNTRY
    setPhone((p) => p.slice(0, next.maxLen))
  }

  const handleSuccessfulAuth = (token: string, userData: any) => {
    toast.success('Logged in successfully!')

    const roleVal = userData?.role || ''
    const roleStr = typeof roleVal === 'string' ? roleVal : roleVal?.name || ''
    const isOwner =
      isRoleAdmin(roleStr) ||
      userData?.is_admin === true ||
      !userData?.firm_company_code

    const firmObj = userData?.firm_id || {}
    const firmName = firmObj?.firm_name || firmObj?.name || 'My Workspace'
    const firmId = firmObj?.firm_id || firmObj?.id || 'ws-default'

    const sessionUser: SessionUser = {
      id: userData?.id || userData?.user_id || '',
      name:
        `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() ||
        userData?.name ||
        'User',
      phone: userData?.phone || userData?.contact_number || digitsOnly,
      email: userData?.email || userData?.employee_email_address || '',
      role: isOwner ? 'OWNER' : (roleStr || 'EMPLOYEE'),
      roles: userData?.roles || [],
      firm_name: firmName,
      firm_id: firmId,
      is_admin: isOwner,
      isSuperAdmin: isOwner,
    }

    const workspaces: WorkspaceRef[] =
      userData?.all_firms && userData.all_firms.length > 0
        ? userData.all_firms.map((f: any) => ({
            id: f?.firm_id?.firm_id || f?.firm_id?.id || 'ws-default',
            name: f?.firm_id?.firm_name || f?.firm_id?.name || 'Workspace',
            role: 'Owner',
          }))
        : [
            {
              id: firmId,
              name: firmName,
              role: isOwner ? 'Owner' : 'Employee',
            },
          ]

    localStorage.setItem('authToken', token)
    localStorage.setItem('userData', JSON.stringify(userData))
    setSession(token, sessionUser, workspaces)

    if (isOwner) {
      navigate('/admin/staff')
    } else {
      navigate('/me')
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setError('')

    // Step 1: Phone check
    if (step === 'phone') {
      if (!phoneValid || busy) return
      setBusy(true)

      try {
        console.log(`Checking registration status for: ${digitsOnly}`)
        let exists = false
        try {
          const result: any = await checkNewUser(digitsOnly)
          console.log('checkNewUser Response:', result)
          const userArray = result?.user || result?.data?.user
          exists = Array.isArray(userArray) && userArray.length > 0
        } catch (checkError: any) {
          console.error('Error checking user status:', checkError)
          if (
            checkError?.response?.status === 404 ||
            checkError?.message?.includes('404')
          ) {
            exists = false
          } else {
            throw checkError
          }
        }

        if (mode === 'login') {
          if (exists) {
            // User exists: proceed to password entry
            setStep('password')
          } else {
            // User not registered: redirect to sign-up
            toast.info('This mobile number is not registered. Proceeding to Sign-up...')
            setMode('signup')
            try {
              console.log(`Sending OTP via SMS gateway to: ${digitsOnly}`)
              await sendOtpViaSmsGateway(digitsOnly)
              toast.success('OTP sent successfully!')
              setOtp('')
              setTimer(30)
              setStep('otp')
            } catch (otpErr: any) {
              console.error('Failed to send OTP:', otpErr)
              setError(otpErr?.message || 'Failed to send OTP via SMS gateway.')
            }
          }
        } else {
          // Mode is signup
          if (exists) {
            setMode('login')
            setStep('password')
          } else {
            try {
              console.log(`Sending OTP via SMS gateway to: ${digitsOnly}`)
              await sendOtpViaSmsGateway(digitsOnly)
              toast.success('OTP sent successfully!')
              setOtp('')
              setTimer(30)
              setStep('otp')
            } catch (otpErr: any) {
              console.error('Failed to send OTP:', otpErr)
              setError(otpErr?.message || 'Failed to send OTP via SMS gateway.')
            }
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || 'Failed to check mobile number'
        setError(errMsg)
        toast.error(errMsg)
      } finally {
        setBusy(false)
      }
      return
    }

    // Step 2: Password Login
    if (step === 'password') {
      if (!password || busy) return
      setBusy(true)
      try {
        const email = formatPhoneAsEmail(digitsOnly)
        console.log('Logging in with email:', email)
        const res: any = await login({ email, password })
        const token = res?.access_token || res?.data?.access_token
        if (!token) {
          throw new Error('Invalid credentials.')
        }

        let userData: any = null
        try {
          userData = await getCurrentUser()
        } catch (uErr) {
          console.error('Failed to fetch user data after login:', uErr)
          userData = res?.user || { id: 'user', name: 'User' }
        }

        handleSuccessfulAuth(token, userData)
      } catch (err: any) {
        console.error('Login failed:', err)
        const errMsg = err?.message || 'Login failed. Please check your password.'
        setError(errMsg)
        toast.error(errMsg)
      } finally {
        setBusy(false)
      }
      return
    }

    // Step 3: OTP Verification for Sign Up
    if (step === 'otp') {
      if (!otpValid || busy) return
      setBusy(true)
      try {
        console.log(`Verifying OTP: ${otp} for number: ${digitsOnly}`)
        await verifyAndLoginViaSmsGateway(digitsOnly, otp)
        toast.success('Mobile number verified successfully!')
        setStep('signup_wizard')
      } catch (err: any) {
        console.error('OTP verification failed:', err)
        const errMsg = err?.message || 'Invalid OTP code. Please try again.'
        setError(errMsg)
        toast.error(errMsg)
      } finally {
        setBusy(false)
      }
      return
    }
  }

  // Handle Signup Wizard completion
  const handleSignupComplete = async (data: SignupData) => {
    setBusy(true)
    setError('')
    try {
      if (data.accountType === 'employee') {
        const payload = {
          firm_company_code: (data.companyCode || '').trim(),
          first_name: data.firstName.trim(),
          last_name: (data.lastName || '').trim(),
          password: data.password.trim(),
          contact_number: digitsOnly,
        }
        console.log('Registering employee with payload:', payload)
        await createNewEmployee(payload)
      } else {
        const payload = {
          attendance_module: true,
          firm_name: (data.firmName || '').trim(),
          first_name: data.firstName.trim(),
          last_name: (data.lastName || '').trim(),
          firm_employee_limit: parseInt(data.employeeCount || '10', 10) || 10,
          password: data.password.trim(),
          firm_contact_number: digitsOnly,
        }
        console.log('Registering business with payload:', payload)
        await createNewBusiness(payload)
      }

      toast.success('Registration Done! Welcome to hisaab.')

      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      })

      // Auto login after registration
      try {
        const email = formatPhoneAsEmail(digitsOnly)
        const loginRes: any = await login({ email, password: data.password || '' })
        const token = loginRes?.access_token || loginRes?.data?.access_token
        if (token) {
          const userData = await getCurrentUser()
          handleSuccessfulAuth(token, userData)
          return
        }
      } catch (loginErr) {
        console.warn('Auto-login after registration failed:', loginErr)
      }

      // Fallback: redirect to password screen
      setPassword(data.password || '')
      setStep('password')
    } catch (err: any) {
      console.error('Registration failed:', err)
      const errMsg = err?.message || 'Registration failed. Please try again.'
      setError(errMsg)
      throw new Error(errMsg)
    } finally {
      setBusy(false)
    }
  }

  const handleResendOtp = async () => {
    if (timer > 0 || busy) return
    setBusy(true)
    setError('')
    try {
      await sendOtpViaSmsGateway(digitsOnly)
      setTimer(30)
      toast.success('New OTP sent successfully!')
    } catch (err: any) {
      setError(err?.message || 'Failed to resend OTP')
      toast.error(err?.message || 'Failed to resend OTP')
    } finally {
      setBusy(false)
    }
  }

  const handleBack = () => {
    setError('')
    if (step === 'signup_wizard') {
      setStep('otp')
    } else if (step === 'otp') {
      setStep('phone')
    } else if (step === 'password') {
      setStep('phone')
    }
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* left: login/signup form */}
      <div className="flex w-full flex-col px-6 py-8 lg:w-1/2 lg:px-12">
        <div className="flex items-center justify-between">
          {step !== 'phone' ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/">← Back to home</Link>
            </Button>
          )}
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            {step === 'signup_wizard' ? (
              <SignupWizard
                onClose={() => setStep('phone')}
                onComplete={handleSignupComplete}
              />
            ) : (
              <>
                {/* Header info based on steps */}
                {step === 'phone' && (
                  <>
                    <h1 className="font-display text-3xl font-semibold tracking-tight text-[#11213f]">
                      {mode === 'login' ? 'Sign in' : 'Sign up'}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {mode === 'login'
                        ? 'Enter your mobile number to continue.'
                        : 'Enter your mobile number to get started.'}
                    </p>
                  </>
                )}

                {step === 'password' && (
                  <>
                    <h1 className="font-display text-3xl font-semibold tracking-tight text-[#11213f]">
                      Enter Password
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Please enter your password to login.
                    </p>
                  </>
                )}

                {step === 'otp' && (
                  <>
                    <h1 className="font-display text-3xl font-semibold tracking-tight text-[#11213f]">
                      Verify OTP
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Enter the {OTP_LENGTH}-digit code sent to {country.dial} {phone}.
                    </p>
                  </>
                )}

                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                  {step === 'phone' && (
                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-sm font-medium text-foreground"
                      >
                        Phone number
                      </label>
                      <div className="mt-1.5 flex rounded-xl border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                        {/* country picker */}
                        <div className="relative flex shrink-0 items-center border-r border-input overflow-hidden">
                          <div className="pointer-events-none flex items-center gap-1.5 py-2.5 pl-3 pr-7 text-sm">
                            <span className="text-base leading-none">
                              {country.flag}
                            </span>
                            <span className="text-muted-foreground">
                              {country.dial}
                            </span>
                          </div>
                          <svg
                            className="pointer-events-none absolute right-2 h-4 w-4 text-muted-foreground"
                            viewBox="0 0 20 20"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M6 8l4 4 4-4"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <select
                            aria-label="Country"
                            value={iso}
                            onChange={(e) => handleCountryChange(e.target.value)}
                            className="absolute inset-0 w-full cursor-pointer opacity-0"
                          >
                            {COUNTRIES.map((c) => (
                              <option key={c.iso} value={c.iso}>
                                {c.name} ({c.dial})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* phone input */}
                        <input
                          id="phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel-national"
                          autoFocus
                          required
                          maxLength={country.maxLen}
                          value={phone}
                          onChange={(e) =>
                            setPhone(
                              e.target.value
                                .replace(/[^\d]/g, '')
                                .slice(0, country.maxLen),
                            )
                          }
                          className="w-full flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                          placeholder="98765 43210"
                        />
                      </div>
                    </div>
                  )}

                  {step === 'password' && (
                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-foreground"
                      >
                        Password
                      </label>
                      <div className="relative mt-1.5 flex items-center">
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoFocus
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full rounded-xl border border-input bg-card pl-3 pr-10 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 'otp' && (
                    <div className="space-y-3">
                      <OtpInputForm
                        value={otp}
                        onChange={setOtp}
                        length={OTP_LENGTH}
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                        <span>Didn't receive code?</span>
                        {timer > 0 ? (
                          <span className="font-medium text-foreground">
                            Resend in {timer}s
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={busy}
                            className="font-semibold text-[#2f63d8] hover:underline cursor-pointer"
                          >
                            Resend OTP
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {error && (
                    <p className="text-center text-[13px] text-rose-600">{error}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full btn-3d bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
                    disabled={
                      (step === 'phone'
                        ? !phoneValid
                        : step === 'otp'
                          ? !otpValid
                          : !password) || busy
                    }
                  >
                    {busy
                      ? 'Please wait…'
                      : step === 'phone'
                        ? 'Continue'
                        : step === 'otp'
                          ? 'Verify OTP'
                          : 'Login'}
                  </Button>

                  {step === 'phone' && (
                    <div className="text-center text-xs text-muted-foreground pt-1">
                      {mode === 'login' ? (
                        <>
                          Don't have an account?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setMode('signup')
                              setError('')
                            }}
                            className="text-[#2f63d8] hover:underline font-semibold cursor-pointer"
                          >
                            Sign up
                          </button>
                        </>
                      ) : (
                        <>
                          Already have an account?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setMode('login')
                              setError('')
                            }}
                            className="text-[#2f63d8] hover:underline font-semibold cursor-pointer"
                          >
                            Sign in
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <p className="text-center text-xs leading-relaxed text-muted-foreground pt-2">
                    By continuing, you agree to our{' '}
                    <a
                      href="https://legal.myhisaab.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2f63d8] hover:underline"
                    >
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a
                      href="https://legal.myhisaab.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2f63d8] hover:underline"
                    >
                      Privacy Policy
                    </a>
                    .
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* right: illustration */}
      <div
        className="relative m-3 hidden overflow-hidden rounded-2xl bg-[#eef4fe] bg-cover bg-center bg-no-repeat lg:block lg:w-1/2"
        style={{ backgroundImage: 'url(/login-bg-payroll.png)' }}
      >
        <img
          src="/logo-big-black.png"
          alt="myHisaab"
          className="absolute left-8 top-8 h-[26px] w-auto select-none"
          draggable={false}
        />
      </div>
    </div>
  )
}

export default PhoneNumberInput
