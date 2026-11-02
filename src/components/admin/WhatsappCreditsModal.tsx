import React, { useState, useEffect } from 'react'
import { X, Plus, Minus, MessageSquare, Check, CheckCheck, Send, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth/AuthContext'

interface WhatsappCreditsModalProps {
  isOpen?: boolean
  onClose?: () => void
  onConfirm?: (result: { credits: number }) => void
}

declare global {
  interface Window {
    Razorpay?: any
  }
}

export default function WhatsappCreditsModal({
  isOpen = true,
  onClose,
  onConfirm,
}: WhatsappCreditsModalProps) {
  const [localOpen, setLocalOpen] = useState(isOpen)
  const [credits, setCredits] = useState<number | ''>(500)
  const { user } = useAuth()
  const [rate, setRate] = useState<number>(1.18)

  useEffect(() => {
    setLocalOpen(isOpen)
  }, [isOpen])

  const fetchPaymentStatus = async (order_id: string) => {
    try {
      const res = await fetch(
        `https://god.myhisaab.com/api/subscription_payment_status?razorpay_order_id=${order_id}`,
      )
      const data = await res.json()
      return data
    } catch (err) {
      console.error('Error fetching payment status:', err)
      return null
    }
  }

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const res = await fetch('https://god.myhisaab.com/api/subscription_products')
        const data = await res.json()
        if (data && data.status === 'success' && Array.isArray(data.products)) {
          const prod = data.products.find(
            (p: any) => p.unique_name === 'whatsapp_credits',
          )
          if (prod && Number(prod.price) > 0) {
            setRate(Number(prod.price))
          }
        }
      } catch (err) {
        console.error('Error fetching credit rate:', err)
      }
    }
    if (localOpen) {
      fetchRate()
    }
  }, [localOpen])

  const handleClose = () => {
    setLocalOpen(false)
    if (onClose) onClose()
  }

  const handleIncrement = () => {
    const currentVal = credits === '' ? 0 : credits
    setCredits(Math.min(currentVal + 100, 10000))
  }

  const handleDecrement = () => {
    const currentVal = credits === '' ? 0 : credits
    setCredits(Math.max(currentVal - 100, 100))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value
    if (valStr === '') {
      setCredits('')
      return
    }
    const val = Number(valStr)
    if (!isNaN(val) && val >= 0) {
      setCredits(val)
    }
  }

  const handleBlur = () => {
    if (credits === '' || credits < 100) {
      setCredits(100)
    } else if (credits > 10000) {
      setCredits(10000)
    }
  }

  const costPerCredit = rate
  const displayCredits = credits === '' ? 0 : credits
  const totalCost = displayCredits * costPerCredit

  const handleContinue = async () => {
    if (displayCredits <= 0) {
      toast.error('Please enter a valid credit amount.')
      return
    }

    if (!window.Razorpay) {
      // dynamically load Razorpay if missing
      await new Promise<boolean>((resolve) => {
        const s = document.createElement('script')
        s.src = 'https://checkout.razorpay.com/v1/checkout.js'
        s.onload = () => resolve(true)
        s.onerror = () => resolve(false)
        document.body.appendChild(s)
      })
    }

    if (!window.Razorpay) {
      toast.error('Razorpay SDK failed to load. Please try again later.')
      return
    }

    try {
      const u = user as any
      const firmId = typeof u?.firm_id === 'object' ? u.firm_id?.firm_id : u?.firm_id
      const firmName = typeof u?.firm_id === 'object' ? u.firm_id?.firm_name : u?.firm_name || u?.name
      const firmEmail = typeof u?.firm_id === 'object' ? u.firm_id?.firm_email : u?.email
      const firmPhone = typeof u?.firm_id === 'object' ? u.firm_id?.firm_phone : u?.phone

      const apiResponse = await fetch('https://god.myhisaab.com/api/create_subscription_payment', {
        method: 'POST',
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              unique_name: 'whatsapp_credits',
              quantity: displayCredits,
            },
          ],
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
          description: `${displayCredits} WhatsApp credits`,
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
            try {
              const verifyRes = await fetch(
                'https://god.myhisaab.com/api/verify_subscription_payment',
                {
                  method: 'POST',
                  headers: {
                    'Content-type': 'application/json',
                  },
                  body: JSON.stringify({
                    razorpay_order_id:
                      paymentResponse.razorpay_order_id || response.razorpay_order_id,
                    razorpay_payment_id: paymentResponse.razorpay_payment_id,
                    razorpay_signature: paymentResponse.razorpay_signature,
                  }),
                },
              )
              const verifyData = await verifyRes.json()
              if (
                verifyData &&
                verifyData.status === 'success' &&
                verifyData.payment_status === 'paid'
              ) {
                toast.success('Credits will be added after sometime')
                if (onConfirm) {
                  onConfirm({ credits: displayCredits })
                }
                handleClose()
              } else {
                toast.error('Payment verification failed. Re-verifying...')
                const data = await fetchPaymentStatus(response.razorpay_order_id)
                if (data && data.status === 'success' && data.payment_status === 'paid') {
                  toast.success('Payments Done. Credits will be added after sometime')
                  if (onConfirm) {
                    onConfirm({ credits: displayCredits })
                  }
                  handleClose()
                } else {
                  toast.error('Payment verification failed. Please contact support.')
                }
              }
            } catch (err) {
              console.error('Verification error:', err)
              toast.error('Payment verification failed. Please contact support.')
            }
          },
        }

        const rzp = new window.Razorpay(options)
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

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-[420px] h-[640px] bg-gradient-to-b from-[#0b5c4f] to-[#063e35] rounded-[36px] overflow-hidden shadow-2xl flex flex-col justify-between p-6 border border-emerald-800/40 animate-in zoom-in-95 duration-200">
        {/* Background Watermark Pattern */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none opacity-[0.06]">
          <MessageSquare className="absolute top-[8%] left-[10%] w-10 h-10 text-white rotate-[15deg]" />
          <CheckCheck className="absolute top-[12%] right-[15%] w-8 h-8 text-white rotate-[-10deg]" />
          <Send className="absolute top-[25%] left-[22%] w-12 h-12 text-white rotate-[25deg]" />
          <Clock className="absolute top-[35%] right-[8%] w-10 h-10 text-white rotate-[-20deg]" />
          <MessageSquare className="absolute top-[50%] left-[8%] w-14 h-14 text-white rotate-[-15deg]" />
          <Check className="absolute top-[55%] right-[22%] w-8 h-8 text-white rotate-[10deg]" />
          <Send className="absolute bottom-[20%] left-[18%] w-10 h-10 text-white rotate-[-30deg]" />
          <MessageSquare className="absolute bottom-[25%] right-[12%] w-12 h-12 text-white rotate-[15deg]" />
          <Clock className="absolute bottom-[8%] left-[30%] w-8 h-8 text-white rotate-[5deg]" />
        </div>

        {/* Top Header Section */}
        <div className="relative z-10 flex justify-end">
          <button
            onClick={handleClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all outline-none cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Section */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4">
          <h2 className="text-white text-2xl md:text-3xl font-extrabold tracking-tight mb-8 max-w-[280px] leading-tight">
            How many credits do you need?
          </h2>

          {/* Stepper & Counter Container */}
          <div className="w-full flex items-center justify-between mb-8 max-w-[320px]">
            <button
              onClick={handleDecrement}
              className="w-14 h-14 rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-90 transition-all flex items-center justify-center border border-white/5 shadow-inner cursor-pointer"
              aria-label="Decrease credits"
            >
              <Minus className="w-6 h-6 stroke-[3]" />
            </button>

            <div className="flex-1 text-center px-2">
              <input
                type="number"
                value={credits}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="500"
                className="bg-transparent text-white text-5xl font-black tracking-tight text-center w-full focus:outline-none border-b-2 border-white/20 focus:border-cyan-300 transition-all font-sans select-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <button
              onClick={handleIncrement}
              className="w-14 h-14 rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-90 transition-all flex items-center justify-center border border-white/5 shadow-inner cursor-pointer"
              aria-label="Increase credits"
            >
              <Plus className="w-6 h-6 stroke-[3]" />
            </button>
          </div>

          {/* Price Description per Credit */}
          <div className="w-full max-w-[260px] flex flex-col items-center mb-6">
            <span className="text-white/60 text-xs font-semibold tracking-wide">
              ₹{costPerCredit.toFixed(2)} per credit · incl. GST
            </span>
          </div>
        </div>

        {/* Footer Section */}
        <div className="relative z-10 flex flex-col items-center gap-4 mt-auto">
          <span className="text-white/70 text-[13px] font-medium tracking-wide">
            Pay once · No auto-renewal
          </span>

          <button
            onClick={handleContinue}
            className="w-full bg-white text-[#0b5c4f] font-bold text-lg py-3.5 leading-none rounded-full shadow-lg hover:shadow-xl hover:bg-emerald-50 active:scale-[0.98] transition-all flex items-center justify-center border border-slate-100 cursor-pointer"
          >
            Continue · ₹{totalCost.toLocaleString('en-IN')}
          </button>
        </div>
      </div>
    </div>
  )
}
