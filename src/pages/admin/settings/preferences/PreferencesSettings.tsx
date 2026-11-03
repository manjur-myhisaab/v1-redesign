import React, { useState } from 'react'
import { Volume2, Sun, Moon, Laptop, VolumeX, Sparkles } from 'lucide-react'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/components/theme-provider'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export const PreferencesSettings: React.FC = () => {
  const { theme, setTheme } = useTheme()
  const [soundOn, setSoundOn] = useState(!sound.isMuted())

  const handleSoundToggle = (enabled: boolean) => {
    setSoundOn(enabled)
    sound.setMuted(!enabled)
    if (enabled) {
      sound.toggle()
    }
  }

  const themeOptions = [
    {
      value: 'light',
      label: 'Light Mode',
      desc: 'Clean, crisp high-contrast daylight theme',
      icon: Sun,
    },
    {
      value: 'dark',
      label: 'Dark Mode',
      desc: 'Reduced eye strain in low-light environments',
      icon: Moon,
    },
    {
      value: 'system',
      label: 'System Preference',
      desc: 'Automatically synchronizes with your device theme',
      icon: Laptop,
    },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
              Preferences
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Personalize system appearance (Light / Dark mode) and interface sound cues.
          </p>
        </div>
      </div>

      {/* 2. Scrollable Content Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Appearance Section */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-2xs space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Theme & Appearance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select your preferred visual aesthetic for the admin console
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {themeOptions.map((opt) => {
            const Icon = opt.icon
            const isSelected = theme === opt.value

            return (
              <div
                key={opt.value}
                onClick={() => setTheme(opt.value as any)}
                className={cn(
                  'relative flex flex-col justify-between p-4 rounded-xl border cursor-pointer transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={cn(
                      'grid size-8 place-items-center rounded-lg transition-colors',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  {isSelected && (
                    <span className="size-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-foreground">{opt.label}</h4>
                  <p className="text-[11px] text-muted-foreground leading-normal">{opt.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Interface Sound Effects */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-2xs space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Sound Effects</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Subtle audio feedback on actions, notifications, and confirmations
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/20">
          <div className="flex items-center gap-3.5">
            <div className="grid size-9 place-items-center rounded-lg bg-muted text-foreground">
              {soundOn ? <Volume2 className="size-4.5 text-primary" /> : <VolumeX className="size-4.5 text-muted-foreground" />}
            </div>
            <div>
              <Label className="text-xs font-medium text-foreground">Interface Audio Feedback</Label>
              <p className="text-[11px] text-muted-foreground">
                Play subtle chimes and clicks on successful operations
              </p>
            </div>
          </div>

          <Switch
            checked={soundOn}
            onCheckedChange={handleSoundToggle}
            aria-label="Toggle Interface Audio Feedback"
          />
        </div>
      </div>
        </div>
      </div>
    </div>
  )
}

export default PreferencesSettings
