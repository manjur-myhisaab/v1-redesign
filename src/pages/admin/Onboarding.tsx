import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { ArrowRight, Sparkles, CalendarClock, Wallet, Loader2, Eye, EyeOff } from 'lucide-react'
import PersonAvatar from '@/components/admin/PersonAvatar'
import ImageUpload from '@/components/admin/ImageUpload'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { updateWorkspace, updateMe } from '@/lib/api'
import { loadProfile } from '@/lib/profile'
import { saveWorkspaceSettings, slugify } from '@/lib/workspaceSettings'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authApi } from '@/features/auth/api/authApi'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const STEP_COUNT = 5
const URL_BASE = 'payroll.myhisaab.com/'

const STEPS = [
  {
    title: "Let's get to know you",
    subtitle: 'Tell us your name and email — just so we know how to reach you.',
    accent: 'bg-[#eaf1ff]',
  },
  {
    title: "Let's make it official",
    subtitle: 'Add your logo and company details — we’ll set you up right away.',
    accent: 'bg-[#f1ecfb]',
  },
  {
    title: 'About your business',
    subtitle: 'A few basics so we can tailor your workspace.',
    accent: 'bg-[#fdeee6]',
  },
  {
    title: 'Set your password',
    subtitle: 'Choose a strong password to protect your account.',
    accent: 'bg-[#eef4fe]',
  },
  {
    title: 'Welcome to myHisaab',
    subtitle: 'Your workspace is ready. Add staff, run payroll, and invite your team.',
    accent: 'bg-[#eaf1ff]',
  },
]

const BENEFITS = [
  { icon: Sparkles, tint: 'text-violet-500', text: 'Add employees and track selfie + GPS attendance.' },
  { icon: Wallet, tint: 'text-blue-500', text: 'Run payroll and generate payslips in a few clicks.' },
  { icon: CalendarClock, tint: 'text-amber-500', text: 'Manage leaves, advances and statutory compliance.' },
]

const TEAM_SIZES = ['1-10', '11-50', '51-200', '200+']
const CATEGORIES = [
  'Retail',
  'Manufacturing',
  'Construction',
  'Hospitality',
  'Healthcare',
  'IT / Software',
  'Logistics',
  'Education',
  'Finance',
  'Other',
]

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' }),
  // .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  // .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  // .regex(/[0-9]/, { message: 'Password must contain at least one number' })
  // .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one special character' }),
  confirm_password: z.string().min(1, { message: 'Confirm password is required' }),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords do not match",
  path: ['confirm_password'],
})

type PasswordFormInputs = z.infer<typeof passwordSchema>

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function splitName(fullName: string) {
  const trimmed = fullName.trim()
  if (!trimmed) {
    return { first_name: '', last_name: '' }
  }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '' }
  }
  if (parts.length === 2) {
    return { first_name: parts[0], last_name: parts[1] }
  }
  // parts.length >= 3
  const first_name = parts.slice(0, 2).join(' ')
  const last_name = parts.slice(2).join(' ')
  return { first_name, last_name }
}

function playConfettiPopSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()

    // Low frequency thump
    const osc = ctx.createOscillator()
    const gainOsc = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(150, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2)
    gainOsc.gain.setValueAtTime(0.4, ctx.currentTime)
    gainOsc.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)

    osc.connect(gainOsc)
    gainOsc.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)

    // High frequency pop noise
    const bufferSize = ctx.sampleRate * 0.08 // 80ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'highpass'
    noiseFilter.frequency.value = 1200

    const gainNoise = ctx.createGain()
    gainNoise.gain.setValueAtTime(0.2, ctx.currentTime)
    gainNoise.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)

    noise.connect(noiseFilter)
    noiseFilter.connect(gainNoise)
    gainNoise.connect(ctx.destination)

    noise.start()
    noise.stop(ctx.currentTime + 0.08)
  } catch (err) {
    console.error("Audio Context failed:", err)
  }
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, activeWorkspace, updateUser, addWorkspace, setSession } = useAuth()
  const wsId = activeWorkspace?.id ?? ''
  const isOwner = activeWorkspace?.role === 'Owner'

  const [idx, setIdx] = useState(0)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [company, setCompany] = useState(activeWorkspace?.name ?? '')
  const [logo, setLogo] = useState<string | undefined>(activeWorkspace?.logo || undefined)
  const [teamSize, setTeamSize] = useState('')
  const [category, setCategory] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<PasswordFormInputs>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
      confirm_password: '',
    },
  })

  const avatarCfg = user ? loadProfile(user.id).avatar : undefined
  const slug = slugify(company) || 'your-workspace'
  const step = STEPS[idx]

  // direction-aware, very subtle step transition
  const [dir, setDir] = useState(1)
  const enterCls = cn(
    'animate-in fade-in duration-300 ease-out',
    dir >= 0 ? 'slide-in-from-right-2' : 'slide-in-from-left-2',
  )
  const goPrev = () => {
    setDir(-1)
    setIdx((i) => Math.max(0, i - 1))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && navigate('/admin/dashboard')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const canContinue =
    idx === 0
      ? name.trim().length > 0 && EMAIL_REGEX.test(email.trim())
      : idx === 1
        ? company.trim().length > 0
        : idx === 2
          ? teamSize !== '' && category !== ''
          : true

  const stepTitle = idx === 3 ? 'Set your password' : step.title
  const stepSubtitle = idx === 3
    ? `Almost there, ${splitName(name).first_name || 'user'}. You'll use this password to sign in to your account.`
    : step.subtitle

  const onSubmitPasswordStep = async (data: PasswordFormInputs) => {
    setBusy(true)
    setSignupError('')
    try {
      const { first_name, last_name } = splitName(name)
      const phone = sessionStorage.getItem('temp_onboarding_phone') || user?.phone || ''
      const signupPayload = {
        first_name,
        last_name,
        mobile_number: phone,
        password: data.password,
        confirm_password: data.confirm_password,
        role: ['OWNER'],
        firm_name: company.trim(),
        firm_type: category,
        team_size: teamSize
      }

      console.log(signupPayload, "signupPayload");


      // Hit registration API
      const res = await authApi.register(signupPayload)

      // Save token, user, and workspace temporarily in sessionStorage
      if (res?.token) {
        const resUser = res.data?.user
        const resFirm = res.data?.firm

        const sessionUser = {
          id: resUser?.user_id || '',
          name: `${resUser?.first_name || ''} ${resUser?.last_name || ''}`.trim() || `${first_name} ${last_name}`.trim(),
          phone: resUser?.mobile_number || phone,
          email: resUser?.email || email,
        }

        const userWorkspaces = resFirm
          ? [{
            id: resFirm.firm_id,
            name: resFirm.firm_name,
            role: 'Owner',
            slug: slugify(resFirm.firm_name),
          }]
          : [{ id: wsId || 'ws-default', name: company || 'My Workspace', role: 'Owner' }]

        sessionStorage.setItem('session_token', res.token)
        sessionStorage.setItem('session_user', JSON.stringify(sessionUser))
        sessionStorage.setItem('session_workspaces', JSON.stringify(userWorkspaces))
      }

      // Toast successful registration
      toast.success('Onboarding Successful, Lets get you in...')

      // Play pop sound
      playConfettiPopSound()

      // Burst beautiful confetti!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      })

      // Go to final welcome step
      setDir(1)
      setIdx(4)
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Registration failed'
      setSignupError(errMsg)
    } finally {
      setBusy(false)
    }
  }

  const onLetsGo = async () => {
    setBusy(true)
    setLoginError('')
    try {
      const phone = sessionStorage.getItem('temp_onboarding_phone') || user?.phone || ''
      const { first_name, last_name } = splitName(name)
      const enteredData = {
        first_name,
        last_name,
        mobile_number: phone,
        password: getValues('password'),
        confirm_password: getValues('confirm_password'),
        role: ['OWNER'],
        firm_name: company.trim(),
        firm_code: slugify(company).toUpperCase().slice(0, 8) || 'ACM30104',
        firm_type: category,
        team_size: teamSize,
        email,
        logo,
      }
      console.log('Onboarding Form Data:', enteredData)

      // Retrieve registered token and formatted session user info from sessionStorage
      const savedToken = sessionStorage.getItem('session_token')
      const sessionUser = JSON.parse(sessionStorage.getItem('session_user') || 'null')
      const userWorkspaces = JSON.parse(sessionStorage.getItem('session_workspaces') || 'null')

      if (!savedToken || !sessionUser) {
        throw new Error('Registration session not found. Please try again.')
      }

      // Clear temp onboarding data from sessionStorage
      sessionStorage.removeItem('temp_onboarding_phone')
      sessionStorage.removeItem('temp_onboarding_otp')
      sessionStorage.removeItem('session_token')
      sessionStorage.removeItem('session_user')
      sessionStorage.removeItem('session_workspaces')

      setSession(savedToken, sessionUser, userWorkspaces)
      // navigate('/admin/dashboard')
      navigate('/admin/employees')
    } catch (err: any) {
      const errMsg = err.message || 'Login failed. Please login manually.'
      setLoginError(errMsg)
    } finally {
      setBusy(false)
    }
  }

  const next = async () => {
    if (idx === 3) {
      await handleSubmit(onSubmitPasswordStep)()
      return
    }
    if (idx === 4) {
      await onLetsGo()
      return
    }

    if (!canContinue || busy) return
    setBusy(true)
    try {
      if (idx === 0) {
        const n = name.trim()
        const em = email.trim()
        updateUser({ name: n, email: em }) // local cache
        try {
          await updateMe({ name: n, email: em })
        } catch {
          /* keep going even if the server write fails */
        }
      } else if (idx === 1 && isOwner && wsId) {
        try {
          const updated = await updateWorkspace(wsId, {
            name: company.trim() || activeWorkspace?.name || '',
            logo: logo ?? '',
            slug,
          })
          addWorkspace(updated)
        } catch {
          /* keep going even if the workspace write fails */
        }
      } else if (idx === 2 && wsId) {
        try {
          saveWorkspaceSettings(wsId, {
            onboarded: true,
          })
        } catch {
          /* keep going */
        }
      }

      setDir(1)
      setIdx((i) => i + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40 font-sans">
      {/* top bar */}
      <header className="flex items-center justify-between px-8 py-5">
        <img
          src="/logo-big-black.png"
          alt="myHisaab"
          className="h-7 w-auto select-none"
          draggable={false}
        />
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === idx ? 'w-5 bg-foreground' : 'w-1.5 bg-border',
              )}
            />
          ))}
        </div>
      </header>

      {/* center card */}
      <main className="grid flex-1 place-items-center px-4 pb-4">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-background shadow-sm md:grid-cols-2">
          {/* left: form */}
          <div className="flex flex-col p-8">
            <div key={idx} className={cn('flex flex-1 flex-col', enterCls)}>
              <span className="text-[13px] font-medium text-muted-foreground">
                {String(idx + 1).padStart(2, '0')} / {String(STEP_COUNT).padStart(2, '0')}
              </span>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
                {stepTitle}
              </h1>
              <p className="mt-1.5 max-w-xs text-[13px] text-muted-foreground">
                {stepSubtitle}
              </p>

              <div className="mt-7 flex-1 space-y-3">
                {idx === 0 && (
                  <>
                    <FloatingInput label="Full name" value={name} onChange={setName} autoFocus />
                    <FloatingInput
                      label="Email"
                      type="email"
                      value={email}
                      onChange={(val) => {
                        setEmail(val)
                        if (!emailTouched) setEmailTouched(true)
                      }}
                      placeholder="you@company.com"
                      error={emailTouched && email.trim() !== '' && !EMAIL_REGEX.test(email.trim()) ? 'Please enter a valid email address' : undefined}
                    />
                  </>
                )}

                {idx === 1 && (
                  <>
                    <ImageUpload
                      label="Company logo"
                      value={logo}
                      onChange={setLogo}
                      prefix={`workspaces/${wsId}/logo`}
                    />
                    <FloatingInput label="Company name" value={company} onChange={setCompany} autoFocus />
                    <div className="rounded-xl border border-input bg-muted/50 px-3.5 py-2">
                      <Label className="block text-[11px] font-medium text-muted-foreground">
                        Workspace URL
                      </Label>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground">{URL_BASE}</span>
                        <span className="font-medium">{slug}</span>
                      </div>
                    </div>
                  </>
                )}

                {idx === 2 && (
                  <div className="space-y-5">
                    {/* Team Size Selection */}
                    <div className="space-y-1.5">
                      <span className="block text-sm font-semibold text-foreground">
                        How big is your team?
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {TEAM_SIZES.map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setTeamSize(size)}
                            className={`px-3.5 py-2 rounded-full text-xs border transition-all cursor-pointer ${teamSize === size
                              ? 'border-[#2f63d8] bg-[#cfe0fb] text-[#2f63d8] font-semibold shadow-sm'
                              : 'border-border bg-card text-foreground hover:bg-secondary/40 font-medium'
                              }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Business Category Grid */}
                    <div className="space-y-1.5">
                      <span className="block text-sm font-semibold text-foreground">
                        What does your business do?
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={`px-3 py-2 rounded-full text-xs border transition-all cursor-pointer text-center ${category === cat
                              ? 'border-[#2f63d8] bg-[#cfe0fb] text-[#2f63d8] font-semibold shadow-sm'
                              : 'border-border bg-card text-foreground hover:bg-secondary/40 font-medium'
                              }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {idx === 3 && (
                  <div className="space-y-4">
                    {/* Create Password */}
                    <div className="space-y-1">
                      <div className={cn(
                        "relative rounded-xl border bg-card px-3.5 py-2 transition-shadow focus-within:ring-1 focus-within:ring-ring flex flex-col justify-center",
                        errors.password
                          ? "border-destructive focus-within:border-destructive focus-within:ring-destructive"
                          : "border-input focus-within:border-ring"
                      )}>
                        <Label className={cn(
                          "block text-[11px] font-medium",
                          errors.password ? "text-destructive" : "text-primary/80"
                        )}>Create password</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter password"
                            {...register('password')}
                            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground font-sans border-0 focus-visible:ring-0 shadow-none h-auto p-0"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      {errors.password && (
                        <p className="text-[11px] text-destructive px-1">{errors.password.message}</p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1">
                      <div className={cn(
                        "relative rounded-xl border bg-card px-3.5 py-2 transition-shadow focus-within:ring-1 focus-within:ring-ring flex flex-col justify-center",
                        errors.confirm_password
                          ? "border-destructive focus-within:border-destructive focus-within:ring-destructive"
                          : "border-input focus-within:border-ring"
                      )}>
                        <Label className={cn(
                          "block text-[11px] font-medium",
                          errors.confirm_password ? "text-destructive" : "text-primary/80"
                        )}>Confirm password</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Confirm password"
                            {...register('confirm_password')}
                            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground font-sans border-0 focus-visible:ring-0 shadow-none h-auto p-0"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      {errors.confirm_password && (
                        <p className="text-[11px] text-destructive px-1">{errors.confirm_password.message}</p>
                      )}
                    </div>

                    {signupError && (
                      <p className="text-[12px] text-destructive font-medium text-center">{signupError}</p>
                    )}
                  </div>
                )}

                {idx === 4 && (
                  <div className="space-y-4">
                    <ul className="space-y-3.5">
                      {BENEFITS.map((b) => (
                        <li key={b.text} className="flex items-start gap-2.5 text-[13px]">
                          <b.icon className={cn('mt-0.5 size-4 shrink-0', b.tint)} />
                          <span>{b.text}</span>
                        </li>
                      ))}
                    </ul>
                    {loginError && (
                      <p className="text-[12px] text-destructive font-medium text-center mt-2">{loginError}</p>
                    )}
                  </div>
                )}
              </div>

              {idx === 0 && (
                <>
                  <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                    By clicking “Continue”, you acknowledge that you have read and agree to
                    myHisaab’s <span className="text-primary">Terms</span> and{' '}
                    <span className="text-primary">Privacy Policy</span>.
                  </p>

                </>
              )}
            </div>

            <div className="mt-6 flex items-center gap-2">
              {idx > 0 && idx < 4 && (
                <Button
                  variant="outline"
                  onClick={goPrev}
                  className="font-medium hover:bg-muted font-sans"
                >
                  Back
                </Button>
              )}
              <Button
                variant={null}
                onClick={next}
                disabled={((idx < 3 && !canContinue) || busy)}
                className="btn-3d inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40 font-sans"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    {idx === STEP_COUNT - 1 ? "Let's Go" : 'Continue'}
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* right: live preview */}
          <div className={cn('hidden place-items-center p-6 transition-colors duration-500 md:grid', step.accent)}>
            <div key={idx} className={cn('grid w-full place-items-center', enterCls)}>
              <Preview
                idx={idx}
                name={name}
                email={email}
                company={company}
                slug={slug}
                logo={logo}
                avatar={<PersonAvatar name={name || 'You'} config={avatarCfg} className="size-16" />}
              />
            </div>
          </div>
        </div>
      </main>

      {/* footer */}
      <footer className="flex items-center justify-between px-8 py-4 text-[13px] text-muted-foreground font-sans">
        <span>
          Logged in as <span className="font-medium text-foreground">{sessionStorage.getItem('temp_onboarding_phone') || user?.phone || email}</span>
        </span>
      </footer>
    </div>
  )
}

function FloatingInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoFocus,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoFocus?: boolean
  error?: string
}) {
  return (
    <div className="space-y-1 font-sans">
      <div className={cn(
        "rounded-xl border bg-card px-3.5 py-2 transition-shadow focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
        error
          ? "border-destructive focus-within:border-destructive focus-within:ring-destructive"
          : "border-input focus-within:border-ring"
      )}>
        <Label className={cn(
          "block text-[11px] font-medium",
          error ? "text-destructive" : "text-primary/80"
        )}>{label}</Label>
        <Input
          type={type}
          value={value}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground border-0 focus-visible:ring-0 shadow-none h-auto p-0"
        />
      </div>
      {error && <p className="text-[11px] text-destructive px-1">{error}</p>}
    </div>
  )
}

function Preview({
  idx,
  name,
  email,
  company,
  slug,
  logo,
  avatar,
}: {
  idx: number
  name: string
  email: string
  company: string
  slug: string
  logo?: string
  avatar: ReactNode
}) {
  const displayCompany = company || 'Your company'
  const displaySlug = slug || 'your-workspace'

  // step 1 — profile card
  if (idx === 0) {
    return (
      <Card>
        <div className="mb-4">{avatar}</div>
        <div className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {name || 'Your name'}
        </div>
        <div className="mt-1 text-[13px] text-muted-foreground font-sans">
          {email || 'you@company.com'}
        </div>
      </Card>
    )
  }

  // step 2 — workspace mock
  if (idx === 1) {
    return (
      <div className="w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-violet-300 to-blue-300 text-xs font-bold text-white">
            {logo ? (
              <img src={logo} alt="" className="size-full object-cover" />
            ) : (
              displayCompany.charAt(0).toUpperCase()
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-foreground">{displayCompany}</div>
            <div className="truncate text-[11px] text-muted-foreground font-sans">
              {URL_BASE}{displaySlug}
            </div>
          </div>
        </div>
        <div className="space-y-2 p-3">
          <div className="h-7 rounded-md bg-primary/15" />
          <div className="h-3 w-3/4 rounded bg-muted" />
          <div className="h-3 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
        </div>
      </div>
    )
  }

  // step 3, 4 & 5 — welcome/branding card
  if (idx >= 2) {
    return (
      <Card>
        <div className="mb-3">{avatar}</div>
        <div className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground">
          {name || 'Welcome'}
        </div>
        <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground font-sans">
          Payroll Admin
        </div>
        <div className="mt-4 text-[13px] text-muted-foreground font-sans">
          {URL_BASE}{displaySlug}
        </div>
      </Card>
    )
  }

  return null
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-xs rounded-2xl border border-border bg-background p-6 shadow-sm font-sans">
      {children}
    </div>
  )
}
