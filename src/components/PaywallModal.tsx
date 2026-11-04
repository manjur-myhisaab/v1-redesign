import React, { useState, useMemo, useEffect } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth/AuthContext'
import { useRazorpay } from 'react-razorpay'
import { useQueryClient } from '@tanstack/react-query'

export interface PaywallModalProps {
  isOpen?: boolean
  onClose?: () => void
  onSubscribe?: (data: any) => void
  showCloseButton?: boolean
}

export default function PaywallModal({
  isOpen = true,
  onClose,
  onSubscribe,
  showCloseButton = true,
}: PaywallModalProps) {
  const [localOpen, setLocalOpen] = useState(isOpen)
  const { user, activeWorkspace } = useAuth()
  const { Razorpay } = useRazorpay()
  const queryClient = useQueryClient()

  useEffect(() => {
    setLocalOpen(isOpen)
  }, [isOpen])

  const handleClose = () => {
    setLocalOpen(false)
    if (onClose) {
      onClose()
    }
  }

  const [billingType, setBillingType] = useState<'annual' | 'per_seat'>('annual')

  // Annual Plan states
  const [selectedAnnualPlan, setSelectedAnnualPlan] = useState<'annual' | 'annual_plus' | 'annual_max'>('annual_plus')

  // Per Seat Plan states
  const [basicSeats, setBasicSeats] = useState(0)
  const [proSeats, setProSeats] = useState(0)

  const fetchPaymentStatus = async (order_id: string) => {
    try {
      const res = await fetch(`https://god.myhisaab.com/api/subscription_payment_status?razorpay_order_id=${order_id}`)
      const data = await res.json()
      return data
    } catch (err) {
      console.error('Error fetching payment status:', err)
      return null
    }
  }

  // Price calculations
  const selectedPlanForBill = useMemo(() => {
    if (billingType === 'annual') {
      if (selectedAnnualPlan === 'annual') {
        return {
          unique_name: 'annual',
          quantity: 1,
          price: 11800,
        }
      }
      if (selectedAnnualPlan === 'annual_plus') {
        return {
          unique_name: 'annual_plus',
          quantity: 1,
          price: 16520,
        }
      }
      if (selectedAnnualPlan === 'annual_max') {
        return {
          unique_name: 'annual_max',
          quantity: 1,
          price: 24780,
        }
      }
      return { unique_name: 'annual_plus', quantity: 1, price: 16520 }
    } else {
      return (basicSeats * 800) + (proSeats * 2154)
    }
  }, [billingType, selectedAnnualPlan, basicSeats, proSeats])

  const handleSubscribe = async () => {
    if (billingType === 'per_seat' && basicSeats === 0 && proSeats === 0) {
      toast.error('Please add at least 1 seat to subscribe.')
      return
    }

    const RazorpayConstructor = Razorpay || (window as any).Razorpay
    if (!RazorpayConstructor) {
      toast.error('Razorpay SDK failed to load. Please try again later.')
      return
    }

    const items: Array<{ unique_name: string; quantity: number }> = []
    if (billingType === 'annual') {
      items.push({
        unique_name: selectedAnnualPlan,
        quantity: 1,
      })
    } else {
      if (basicSeats > 0) {
        items.push({
          unique_name: 'basic',
          quantity: basicSeats,
        })
      }
      if (proSeats > 0) {
        items.push({
          unique_name: 'pro',
          quantity: proSeats,
        })
      }
    }

    const rawFirm = (user as any)?.firm_id
    const firmId = typeof rawFirm === 'object' ? rawFirm?.firm_id : (rawFirm || activeWorkspace?.id)
    const firmName = typeof rawFirm === 'object' ? rawFirm?.firm_name : ((user as any)?.firm_name || activeWorkspace?.name || user?.name || '')
    const firmEmail = typeof rawFirm === 'object' ? rawFirm?.firm_email : (user?.email || '')
    const firmPhone = typeof rawFirm === 'object' ? rawFirm?.firm_phone : (user?.phone || '')

    try {
      const apiResponse = await fetch('https://god.myhisaab.com/api/create_subscription_payment', {
        method: 'POST',
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          items,
          app_firm_id: firmId,
          customer_name: firmName,
          customer_email: firmEmail,
          customer_contact: firmPhone,
        }),
      })

      const response = await apiResponse.json()
      if (response && response.status === 'success') {
        const options = {
          key: response.razorpay_key_id,
          amount: Math.round(response.amount * 100),
          currency: response.currency,
          name: 'myHisaab',
          description: 'Subscription Plan',
          image: 'https://myhisaab.com/brand-icon.png',
          order_id: response.razorpay_order_id,
          prefill: {
            name: response?.customer_name || '',
            email: response?.customer_email || '',
            contact: response?.customer_contact || '',
          },
          theme: {
            color: '#6f9ff1',
          },
          handler: async function (paymentResponse: any) {
            console.log('Payment Success! ID:', paymentResponse.razorpay_payment_id)
            try {
              const verifyRes = await fetch('https://god.myhisaab.com/api/verify_subscription_payment', {
                method: 'POST',
                headers: {
                  'Content-type': 'application/json',
                },
                body: JSON.stringify({
                  razorpay_order_id: paymentResponse.razorpay_order_id || response.razorpay_order_id,
                  razorpay_payment_id: paymentResponse.razorpay_payment_id,
                  razorpay_signature: paymentResponse.razorpay_signature,
                }),
              })
              const verifyData = await verifyRes.json()
              if (verifyData && verifyData.status === 'success' && verifyData.payment_status === 'paid') {
                toast.success('Subscription will be activated after sometime.')
                queryClient.invalidateQueries({ queryKey: ['firm-details'] })
                queryClient.invalidateQueries({ queryKey: ['firms'] })
                queryClient.invalidateQueries({ queryKey: ['staff-all'] })
                if (onSubscribe) {
                  onSubscribe(verifyData)
                }
                handleClose()
              } else {
                toast.error('Payment verification failed. Please contact support.')
                const toastId = toast.loading('Re-verifying payment...')
                try {
                  const data = await fetchPaymentStatus(response.razorpay_order_id)
                  if (data && data.status === 'success' && data.payment_status === 'paid') {
                    toast.success('Payments Done. Subscription will be activated after sometime.')
                    queryClient.invalidateQueries({ queryKey: ['firm-details'] })
                    queryClient.invalidateQueries({ queryKey: ['firms'] })
                    queryClient.invalidateQueries({ queryKey: ['staff-all'] })
                    handleClose()
                    toast.dismiss(toastId)
                  } else {
                    toast.dismiss(toastId)
                    toast.error('Payment verification failed. Please contact support.')
                  }
                } catch (error) {
                  console.error('Verification error:', error)
                  toast.dismiss(toastId)
                  toast.error('Payment verification failed. Please contact support.')
                }
              }
            } catch (err) {
              console.error('Verification error:', err)
              toast.error('Payment verification failed. Please contact support.')
            }
          },
        }

        const rzp = new RazorpayConstructor(options)
        rzp.open()
      } else {
        toast.error(response?.message || 'Failed to initiate payment. Please try again.')
      }
    } catch (err) {
      console.error('Payment error:', err)
      toast.error('An error occurred during checkout initialization.')
    }
  }

  if (!localOpen) return null

  const clientLogos = [
    '/clients/client-01.webp',
    '/clients/client-02.webp',
    '/clients/client-03.webp',
    '/clients/client-04.webp',
    '/clients/client-05.webp',
    '/clients/client-06.webp',
    '/clients/client-07.webp',
    '/clients/client-08.webp',
    '/clients/client-10.webp',
    '/clients/client-11.webp',
    '/clients/client-12.webp',
    '/clients/client-13.webp',
    '/clients/client-14.webp',
    '/clients/client-15.webp',
  ]

  const marqueeLogos = [...clientLogos, ...clientLogos]

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <style>{`
        @keyframes paywallMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-paywall-marquee {
          display: flex;
          width: max-content;
          animation: paywallMarquee 25s linear infinite;
        }
        .animate-paywall-marquee:hover {
          animation-play-state: paused;
        }
        .paywall-logo-item {
          flex: 0 0 20cqw;
          width: 20cqw;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 8px;
        }
      `}</style>

      <div className="relative w-full max-w-md md:max-w-4xl bg-slate-50 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh] md:h-[650px] border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        {showCloseButton && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-2 right-2 md:top-3 md:right-3 z-30 p-1.5 rounded-full hover:bg-slate-200/80 transition-colors text-slate-400 hover:text-slate-600 outline-none cursor-pointer"
            aria-label="Close paywall"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        )}

        {/* Left Column (Desktop Only) */}
        <div className="hidden md:flex md:w-[48%] md:flex-col md:justify-between md:bg-white md:p-8 md:border-r md:border-slate-200/60 md:overflow-y-auto">
          <div>
            {/* Logo and Brand */}
            <div className="flex items-center gap-4">
              <img src="/brand-icon.png" alt="brandIcon" className="w-12 h-12 md:w-14 md:h-14 object-contain" />
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">myHisaab Payroll</h2>
                <p className="text-xs md:text-sm text-slate-500 font-medium leading-tight mt-1">
                  Add unlimited staff with automated attendance and payroll.
                </p>
              </div>
            </div>

            {/* Feature Bullets */}
            <div className="flex flex-col gap-4 my-8">
              {[
                { title: 'Unlimited Employees', desc: 'Add and manage all your staff members.' },
                { title: 'Automated Attendance', desc: 'Realtime check-ins and calculation.' },
                { title: 'One-Click Payroll', desc: 'Generate salary slips & export Excel/PDF.' },
                { title: 'WhatsApp Integration', desc: 'Send payslips and updates instantly.' },
                { title: 'Offline GPS Tracking', desc: 'Real-time location tracking for field staff.' },
              ].map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="mt-1 flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">
                    <svg className="w-3 h-3 font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800 leading-snug">{feat.title}</h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Social Proof (Trusted By stats) */}
          <div className="space-y-6 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-3 text-center select-none">
              <div>
                <p className="font-black text-slate-800 text-lg md:text-xl">4.8★</p>
                <p className="text-[10px] md:text-xs text-slate-400 font-bold">App rating</p>
              </div>
              <div className="border-x border-slate-100">
                <p className="font-black text-slate-800 text-lg md:text-xl">10,000+</p>
                <p className="text-[10px] md:text-xs text-slate-400 font-bold">Businesses</p>
              </div>
              <div>
                <p className="font-black text-slate-800 text-lg md:text-xl">1M+</p>
                <p className="text-[10px] md:text-xs text-slate-400 font-bold">Payslips issued</p>
              </div>
            </div>

            {/* Partner Logos Infinite Marquee */}
            <div
              className="relative overflow-hidden w-full h-12 select-none flex items-center bg-slate-50/50 rounded-xl px-1"
              style={{ containerType: 'inline-size' } as React.CSSProperties}
            >
              {/* Fade masks */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

              <div className="animate-paywall-marquee">
                {marqueeLogos.map((src, idx) => (
                  <div key={idx} className="paywall-logo-item">
                    <img
                      src={src}
                      alt="Client Logo"
                      className="h-12 w-auto object-contain opacity-55 hover:opacity-100 hover:scale-105 transition-all duration-200"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column / Mobile Container */}
        <div className="w-full md:w-[52%] flex flex-col h-full relative pt-3">
          {/* Top Header - Mobile Only */}
          <div className="p-5 flex items-start justify-between md:hidden">
            <div className="flex items-center gap-3">
              <img src="/brand-icon.png" alt="brandIcon" className="w-10 h-10 object-contain" />
              <div>
                <h2 className="text-lg font-bold text-slate-800 leading-tight">myHisaab Payroll</h2>
                <p className="text-xs text-slate-500 font-medium leading-tight mt-0.5">
                  Add unlimited staff with automated attendance and payroll.
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable Content Container */}
          <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-28 pt-4 md:pt-8 mb-20">
            {/* Billing Type Selector Tabs */}
            <div className="bg-slate-200 sticky top-0 z-10 p-1 md:p-1.5 rounded-2xl flex items-center mb-4 md:mb-6 border border-slate-200/40">
              <button
                type="button"
                onClick={() => setBillingType('annual')}
                className={`flex-1 py-2.5 md:py-3.5 text-sm md:text-base font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                  billingType === 'annual'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Annual
              </button>
              <button
                type="button"
                onClick={() => setBillingType('per_seat')}
                className={`flex-1 py-2.5 md:py-3.5 text-sm md:text-base font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                  billingType === 'per_seat'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Per seat
              </button>
            </div>

            {/* Subtitle Message */}
            <p className="text-xs md:text-sm text-slate-500 font-bold mb-4 md:mb-6 px-1">
              {billingType === 'annual'
                ? 'One fixed yearly plan for your whole team'
                : 'Mix Basic & Pro — set how many of each'}
            </p>

            {/* View 1: Annual Plans */}
            {billingType === 'annual' && (
              <div className="space-y-3 md:space-y-4">
                {[
                  { id: 'annual' as const, name: 'Annual', desc: 'Up to 100 employees', price: '₹11,800', badge: null },
                  { id: 'annual_plus' as const, name: 'Annual Plus', desc: 'Up to 500 employees', price: '₹16,520', badge: 'Most popular' },
                  { id: 'annual_max' as const, name: 'Annual Max', desc: '500+ employees', price: '₹24,780', badge: null },
                ].map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedAnnualPlan(plan.id)}
                    className={`flex items-center justify-between p-4 md:p-5 bg-white rounded-2xl border cursor-pointer transition-all duration-200 select-none ${
                      selectedAnnualPlan === plan.id
                        ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-sm'
                        : 'border-slate-150 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Blue Radio Checkbox */}
                      <div
                        className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedAnnualPlan === plan.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {selectedAnnualPlan === plan.id && (
                          <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm md:text-base">{plan.name}</span>
                          {plan.badge && (
                            <span className="text-[10px] md:text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs md:text-sm text-slate-500 font-medium">{plan.desc}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold md:font-black text-slate-800 text-sm md:text-lg">{plan.price}</span>
                      <p className="text-[9px] md:text-xs text-slate-400 font-medium">/year</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* View 2: Per Seat Option */}
            {billingType === 'per_seat' && (
              <div className="space-y-3 md:space-y-4">
                {/* Basic Seat option */}
                <div className="p-4 md:p-5 bg-white rounded-2xl border border-slate-150 flex items-center justify-between shadow-sm">
                  <div className="space-y-1 pr-4 flex-1">
                    <h3 className="font-bold text-slate-800 text-sm md:text-base">Basic</h3>
                    <p className="text-xs md:text-sm text-slate-500 font-medium leading-tight">
                      Attendance, payroll & payslips for your core team.
                    </p>
                    <p className="text-xs md:text-sm font-bold text-slate-800 mt-1">
                      ₹800 <span className="text-slate-400 font-medium">/ seat</span>
                    </p>
                  </div>

                  {/* Counter Control */}
                  <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                    <button
                      type="button"
                      onClick={() => setBasicSeats((s) => Math.max(0, s - 1))}
                      disabled={basicSeats === 0}
                      className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center border transition-all ${
                        basicSeats === 0
                          ? 'text-slate-300 border-slate-100 bg-white cursor-not-allowed'
                          : 'text-slate-600 border-slate-200 bg-white hover:bg-slate-50 active:scale-95 cursor-pointer'
                      }`}
                    >
                      <Minus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                    <span className="w-6 text-center font-bold text-slate-800 text-sm md:text-base">{basicSeats}</span>
                    <button
                      type="button"
                      onClick={() => setBasicSeats((s) => s + 1)}
                      className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>

                {/* Pro Seat option */}
                <div className="p-4 md:p-5 bg-white rounded-2xl border border-slate-150 flex items-center justify-between shadow-sm">
                  <div className="space-y-1 pr-4 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-sm md:text-base">Pro</h3>
                      <span className="text-[10px] md:text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                        Live tracking
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-slate-500 font-medium leading-tight">
                      Everything in Basic, plus offline live GPS tracking.
                    </p>
                    <p className="text-xs md:text-sm font-bold text-slate-800 mt-1">
                      ₹2,400 <span className="text-slate-400 font-medium">/ seat</span>
                    </p>
                  </div>

                  {/* Counter Control */}
                  <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                    <button
                      type="button"
                      onClick={() => setProSeats((s) => Math.max(0, s - 1))}
                      disabled={proSeats === 0}
                      className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center border transition-all ${
                        proSeats === 0
                          ? 'text-slate-300 border-slate-100 bg-white cursor-not-allowed'
                          : 'text-slate-600 border-slate-200 bg-white hover:bg-slate-50 active:scale-95 cursor-pointer'
                      }`}
                    >
                      <Minus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                    <span className="w-6 text-center font-bold text-slate-800 text-sm md:text-base">{proSeats}</span>
                    <button
                      type="button"
                      onClick={() => setProSeats((s) => s + 1)}
                      className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Divider - Mobile Only */}
            <div className="my-5 flex items-center gap-3 md:hidden">
              <div className="h-[1px] bg-slate-200 flex-1" />
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Trusted By</span>
              <div className="h-[1px] bg-slate-200 flex-1" />
            </div>

            {/* Social Proof (Trusted By stats) - Mobile Only */}
            <div className="bg-white rounded-2xl border border-slate-150/80 p-4 shadow-sm space-y-4 md:hidden">
              <div className="grid grid-cols-3 gap-2 text-center select-none">
                <div>
                  <p className="font-extrabold text-slate-800 text-sm">4.8★</p>
                  <p className="text-[10px] text-slate-400 font-medium">App rating</p>
                </div>
                <div className="border-x border-slate-100">
                  <p className="font-extrabold text-slate-800 text-sm">10,000+</p>
                  <p className="text-[10px] text-slate-400 font-medium">Businesses</p>
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 text-sm">1M+</p>
                  <p className="text-[10px] text-slate-400 font-medium">Payslips issued</p>
                </div>
              </div>

              <div className="h-[1px] bg-slate-100" />

              {/* Partner Logos Infinite Marquee */}
              <div
                className="relative overflow-hidden w-full h-12 select-none flex items-center bg-slate-50/50 rounded-xl px-1"
                style={{ containerType: 'inline-size' } as React.CSSProperties}
              >
                {/* Fade masks */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

                <div className="animate-paywall-marquee">
                  {marqueeLogos.map((src, idx) => (
                    <div key={idx} className="paywall-logo-item">
                      <img
                        src={src}
                        alt="Client Logo"
                        className="h-12 w-auto object-contain opacity-55 hover:opacity-100 hover:scale-105 transition-all duration-200"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div className="absolute bottom-0 z-20 inset-x-0 bg-slate-50/95 md:bg-white/95 backdrop-blur-md border-t border-slate-200/60 p-4 md:p-6 flex flex-col items-center gap-1.5 shadow-[0_-8px_24px_rgba(148,163,184,0.06)]">
            <button
              type="button"
              onClick={handleSubscribe}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white py-3.5 md:py-4 px-6 rounded-2xl font-black text-sm md:text-base tracking-wide shadow-lg shadow-blue-600/20 active:shadow-none transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
            >
              {billingType === 'annual'
                ? `Subscribe for ₹${(typeof selectedPlanForBill === 'object' ? selectedPlanForBill.price : 0).toLocaleString('en-IN')}`
                : typeof selectedPlanForBill === 'number' && selectedPlanForBill > 0
                  ? `Subscribe for ₹${selectedPlanForBill.toLocaleString('en-IN')}`
                  : 'Subscribe'}
            </button>

            <p className="text-[10px] md:text-xs text-slate-400 font-bold text-center select-none leading-none mt-0.5">
              {billingType === 'annual'
                ? 'Billed yearly • 18% GST included'
                : 'One-time charge per seat • 18% GST included'}
            </p>

            <a
              href="https://legal.myhisaab.com/"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] md:text-xs font-bold text-blue-600 hover:underline hover:text-blue-700 transition mt-0.5"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
