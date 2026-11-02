// Tiny shared Razorpay checkout helper. Loads the checkout script on demand and
// opens the hosted checkout for a server-created order. UpgradeModal keeps its
// own inline copy; this is used by the "Pay now" invoice flow.
import type { BillingOrder } from './api'

type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void }

export function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: RazorpayCtor }).Razorpay) return resolve(true)
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export interface CheckoutResult {
  paymentId: string
  signature: string
}

// Opens Razorpay checkout for an order. Resolves with the payment result on
// success, or null if the user dismisses the modal. Rejects if the script can't load.
export function openCheckout(
  order: BillingOrder,
  opts: { name?: string; description?: string } = {},
): Promise<CheckoutResult | null> {
  return new Promise((resolve, reject) => {
    loadRazorpay().then((ok) => {
      if (!ok) return reject(new Error('Could not load Razorpay checkout'))
      const Razorpay = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay
      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: opts.name ?? 'myHisaab Payroll',
        description: opts.description,
        theme: { color: '#2f63d8' },
        handler: (resp: { razorpay_payment_id: string; razorpay_signature: string }) =>
          resolve({ paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }),
        modal: { ondismiss: () => resolve(null) },
      })
      rzp.open()
    })
  })
}
