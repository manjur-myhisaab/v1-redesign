import React, { useState, useEffect } from 'react'
import { Server, Check, RotateCw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  PRESET_SERVER_URLS,
  ALLOWED_SERVER_CONTROL_USER_IDS,
  getEffectiveApiUrl,
} from '@/services/server'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'

export const ServerControlSettings: React.FC = () => {
  const { user } = useAuth()
  const userId = user?.id || (user as any)?.user_id

  const isAuthorized = ALLOWED_SERVER_CONTROL_USER_IDS.includes(String(userId))

  const [currentCustomUrl, setCurrentCustomUrl] = useState('')
  const [selectedOption, setSelectedOption] = useState('')
  const [customInput, setCustomInput] = useState('')

  const activeUrl = getEffectiveApiUrl()

  useEffect(() => {
    const saved = localStorage.getItem('custom_server_url') || ''
    setCurrentCustomUrl(saved)

    const isPreset = PRESET_SERVER_URLS.some((p) => p.value === saved)
    if (saved && isPreset) {
      setSelectedOption(saved)
    } else if (saved) {
      setSelectedOption('custom')
      setCustomInput(saved)
    } else {
      setSelectedOption(activeUrl)
    }
  }, [activeUrl])

  if (!isAuthorized) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">
        Server control is restricted to authorized developer accounts.
      </div>
    )
  }

  const handleApply = () => {
    let target = selectedOption
    if (selectedOption === 'custom') {
      if (!customInput.trim()) {
        toast.error('Please enter a valid server URL')
        return
      }
      target = customInput.trim()
    }

    try {
      localStorage.setItem('custom_server_url', target)
      toast.success(`Active environment switched to ${target}. Reloading...`)
      setTimeout(() => {
        window.location.reload()
      }, 800)
    } catch (e: any) {
      toast.error('Failed to save server configuration')
    }
  }

  const handleReset = () => {
    localStorage.removeItem('custom_server_url')
    toast.success('Reset to default environment. Reloading...')
    setTimeout(() => {
      window.location.reload()
    }, 800)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
              <Server className="size-4" />
            </div>
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
              Server Environment
            </h1>
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-mono">
              Admin Dev
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Switch active backend endpoint dynamically for testing and staging environments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs">
            Active: {activeUrl}
          </Badge>
        </div>
      </div>

      {/* 2. Scrollable Content Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Preset Options */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-2xs space-y-4">
        <Label className="text-xs font-semibold text-foreground">Target API Endpoint</Label>

        <div className="space-y-2.5">
          {PRESET_SERVER_URLS.map((preset) => {
            const isSelected = selectedOption === preset.value

            return (
              <div
                key={preset.value}
                onClick={() => setSelectedOption(preset.value)}
                className={cn(
                  'flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-2xs'
                    : 'border-border bg-card hover:bg-muted/30'
                )}
              >
                <div>
                  <h4 className="text-xs font-semibold text-foreground">{preset.label}</h4>
                  <p className="text-[11px] text-muted-foreground font-mono">{preset.value}</p>
                </div>
                {isSelected && <Check className="size-4 text-primary" />}
              </div>
            )
          })}

          {/* Custom option */}
          <div
            onClick={() => setSelectedOption('custom')}
            className={cn(
              'p-3.5 rounded-xl border cursor-pointer transition-all space-y-2',
              selectedOption === 'custom'
                ? 'border-primary bg-primary/5 shadow-2xs'
                : 'border-border bg-card hover:bg-muted/30'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-foreground">Custom Endpoint</h4>
                <p className="text-[11px] text-muted-foreground">Specify a custom Directus backend URL</p>
              </div>
              {selectedOption === 'custom' && <Check className="size-4 text-primary" />}
            </div>

            {selectedOption === 'custom' && (
              <Input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="https://your-custom-backend.com"
                className="h-8 text-xs font-mono bg-background"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RotateCw className="size-3.5 mr-1" />
            Reset to Default
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="text-xs h-8 gap-1.5 cursor-pointer font-semibold"
          >
            Apply &amp; Reload
          </Button>
        </div>
      </div>
        </div>
      </div>
    </div>
  )
}

export default ServerControlSettings
