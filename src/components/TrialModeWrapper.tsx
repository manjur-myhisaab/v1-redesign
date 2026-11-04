import React from 'react'
import { useAuth } from '@/context/auth/AuthContext'

interface TrialModeWrapperProps {
  children?: React.ReactNode
}

export default function TrialModeWrapper({ children }: TrialModeWrapperProps) {
  const { user, activeWorkspace } = useAuth()

  const rawFirm = (user as any)?.firm_id
  const subscriptionPlan =
    (typeof rawFirm === 'object' ? rawFirm?.subscription_plan : null) ||
    activeWorkspace?.plan ||
    (user as any)?.subscription_plan

  const isExpired = subscriptionPlan === 'trial_over'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: '2px solid #f7941d',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 89999,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: isExpired ? '#ef4444' : '#f7941d',
          color: 'white',
          padding: '2px 10px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          borderRadius: '0 0 6px 6px',
          zIndex: 90000,
          pointerEvents: 'auto',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }}
      >
        {isExpired ? 'Trial Mode Expired' : 'Trial Mode'}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'auto',
          pointerEvents: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}
