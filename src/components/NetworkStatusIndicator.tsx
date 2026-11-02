import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Wifi,
  WifiOff,
  Radio,
  RefreshCw,
  Zap,
  Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type NetworkGeneration = '5G' | '4G' | '3G' | '2G' | 'Offline'

interface NetworkInfo {
  online: boolean
  generation: NetworkGeneration
  effectiveType: '5g' | '4g' | '3g' | '2g' | 'slow-2g' | 'unknown'
  downlink: number | null // in Mbps
  rtt: number | null // in ms
  saveData: boolean
  latency: number | null // measured round-trip ping in ms
  strengthBars: number // 0 to 5
  strengthLabel: 'Ultra (5G)' | 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Disconnected'
  lastChecked: Date
}

export default function NetworkStatusIndicator() {
  const [open, setOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Intelligent generation & strength calculator (5G / 4G / 3G / 2G)
  const calculateGenerationAndStrength = (
    online: boolean,
    latency: number | null,
    effectiveType: string,
    downlink: number | null,
  ): {
    generation: NetworkGeneration
    bars: number
    label: NetworkInfo['strengthLabel']
    detectedEffectiveType: NetworkInfo['effectiveType']
  } => {
    if (!online) {
      return {
        generation: 'Offline',
        bars: 0,
        label: 'Disconnected',
        detectedEffectiveType: 'slow-2g',
      }
    }

    // 5G Detection: Low ping latency (< 75ms) or high bandwidth downlink (>= 10 Mbps)
    const isUltraFast =
      (latency !== null && latency <= 75) ||
      (downlink !== null && downlink >= 10)

    if (isUltraFast) {
      return {
        generation: '5G',
        bars: 5,
        label: 'Ultra (5G)',
        detectedEffectiveType: '5g',
      }
    }

    // 4G Detection: Good latency (75ms - 180ms) or 4G connection
    if ((latency !== null && latency < 180) || effectiveType === '4g') {
      return {
        generation: '4G',
        bars: 4,
        label: 'Excellent',
        detectedEffectiveType: '4g',
      }
    }

    // 3G Detection: Moderate latency (180ms - 400ms) or 3G connection
    if ((latency !== null && latency < 400) || effectiveType === '3g') {
      return {
        generation: '3G',
        bars: 3,
        label: 'Good',
        detectedEffectiveType: '3g',
      }
    }

    // 2G / Slow connection
    if ((latency !== null && latency < 750) || effectiveType === '2g') {
      return {
        generation: '2G',
        bars: 2,
        label: 'Fair',
        detectedEffectiveType: '2g',
      }
    }

    return {
      generation: '2G',
      bars: 1,
      label: 'Poor',
      detectedEffectiveType: 'slow-2g',
    }
  }

  const getInitialState = (): NetworkInfo => {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null
    const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection

    const effectiveType = conn?.effectiveType || '4g'
    const downlink = typeof conn?.downlink === 'number' ? conn.downlink : null
    const rtt = typeof conn?.rtt === 'number' ? conn.rtt : null
    const saveData = Boolean(conn?.saveData)

    const { generation, bars, label, detectedEffectiveType } =
      calculateGenerationAndStrength(online, rtt, effectiveType, downlink)

    return {
      online,
      generation,
      effectiveType: detectedEffectiveType,
      downlink,
      rtt,
      saveData,
      latency: rtt,
      strengthBars: bars,
      strengthLabel: label,
      lastChecked: new Date(),
    }
  }

  const [network, setNetwork] = useState<NetworkInfo>(getInitialState)

  // Measure latency with a fast lightweight ping
  const checkLatency = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setNetwork((prev) => ({
        ...prev,
        online: false,
        generation: 'Offline',
        strengthBars: 0,
        strengthLabel: 'Disconnected',
        latency: null,
        lastChecked: new Date(),
      }))
      return
    }

    setTesting(true)
    const startTime = performance.now()
    try {
      // Fetch a small cache-busted request to measure true round trip latency
      await fetch(`/favicon.ico?_t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        mode: 'no-cors',
      })
      const endTime = performance.now()
      const measuredLatency = Math.round(endTime - startTime)

      const nav = typeof navigator !== 'undefined' ? (navigator as any) : null
      const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection
      const effType = conn?.effectiveType || '4g'
      const dl = typeof conn?.downlink === 'number' ? conn.downlink : null

      const { generation, bars, label, detectedEffectiveType } =
        calculateGenerationAndStrength(true, measuredLatency, effType, dl)

      setNetwork({
        online: true,
        generation,
        effectiveType: detectedEffectiveType,
        downlink: dl,
        rtt: typeof conn?.rtt === 'number' ? conn.rtt : measuredLatency,
        saveData: Boolean(conn?.saveData),
        latency: measuredLatency,
        strengthBars: bars,
        strengthLabel: label,
        lastChecked: new Date(),
      })
    } catch {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false
      const { generation, bars, label, detectedEffectiveType } =
        calculateGenerationAndStrength(isOnline, 999, 'slow-2g', null)
      setNetwork((prev) => ({
        ...prev,
        online: isOnline,
        generation: isOnline ? generation : 'Offline',
        strengthBars: isOnline ? bars : 0,
        strengthLabel: isOnline ? label : 'Disconnected',
        effectiveType: detectedEffectiveType,
        latency: null,
        lastChecked: new Date(),
      }))
    } finally {
      setTesting(false)
    }
  }, [])

  // Listen for online / offline and connection change events
  useEffect(() => {
    const handleOnline = () => {
      toast.success('Internet connection restored!', { duration: 3000 })
      checkLatency()
    }

    const handleOffline = () => {
      toast.error('You are offline. Please check your internet connection.', {
        duration: 5000,
      })
      setNetwork((prev) => ({
        ...prev,
        online: false,
        generation: 'Offline',
        strengthBars: 0,
        strengthLabel: 'Disconnected',
        latency: null,
        lastChecked: new Date(),
      }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null
    const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection

    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', checkLatency)
    }

    // Initial check
    checkLatency()

    // Periodic check every 15 seconds
    const interval = setInterval(checkLatency, 15000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (conn && typeof conn.removeEventListener === 'function') {
        conn.removeEventListener('change', checkLatency)
      }
      clearInterval(interval)
    }
  }, [checkLatency])

  // Close popover on outside click
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Helper colors based on strength bars
  const getSignalColor = (generation: NetworkGeneration) => {
    if (generation === '5G') return 'text-cyan-400'
    if (generation === '4G') return 'text-emerald-400'
    if (generation === '3G') return 'text-emerald-400'
    if (generation === '2G') return 'text-amber-400'
    return 'text-rose-500'
  }

  const getBarBg = (barIndex: number, currentBars: number, generation: NetworkGeneration) => {
    if (currentBars === 0) return 'bg-white/20'
    if (barIndex <= currentBars) {
      if (generation === '5G') return 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]'
      if (currentBars >= 4) return 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
      if (currentBars >= 3) return 'bg-emerald-400'
      if (currentBars === 2) return 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]'
      return 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]'
    }
    return 'bg-white/20'
  }

  return (
    <div ref={popoverRef} className="relative">
      {/* Trigger Button in TabBar/Header */}
      <button
        type="button"
        aria-label="Internet availability, 5G/4G network and tower strength"
        onClick={() => setOpen(!open)}
        className={cn(
          'group relative flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-all duration-200 cursor-pointer select-none',
          network.online
            ? network.generation === '5G'
              ? 'text-white/95 hover:bg-white/15 border border-cyan-400/30 bg-cyan-500/10'
              : 'text-white/90 hover:bg-white/15 hover:text-white'
            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 animate-pulse',
        )}
        title={`Network: ${network.generation} (${network.strengthLabel}) · ${network.latency ? `${network.latency}ms` : network.online ? 'Online' : 'Offline'}`}
      >
        {/* Cellular Tower / Signal Strength Bars (5 Bars for 5G) */}
        <div className="flex items-end gap-[2px] h-3.5 px-0.5">
          <span className={cn('w-[2.5px] h-[3.5px] rounded-xs transition-colors duration-300', getBarBg(1, network.strengthBars, network.generation))} />
          <span className={cn('w-[2.5px] h-[6px] rounded-xs transition-colors duration-300', getBarBg(2, network.strengthBars, network.generation))} />
          <span className={cn('w-[2.5px] h-[8.5px] rounded-xs transition-colors duration-300', getBarBg(3, network.strengthBars, network.generation))} />
          <span className={cn('w-[2.5px] h-[11px] rounded-xs transition-colors duration-300', getBarBg(4, network.strengthBars, network.generation))} />
          <span className={cn('w-[2.5px] h-[13.5px] rounded-xs transition-colors duration-300', getBarBg(5, network.strengthBars, network.generation))} />
        </div>

        {/* 5G / 4G / Ping Badge */}
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'px-1 py-0.2 rounded font-mono text-[10px] font-bold tracking-tight',
              network.generation === '5G'
                ? 'bg-cyan-400 text-slate-950 shadow-xs'
                : network.generation === '4G'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-white/80',
            )}
          >
            {network.online ? network.generation : 'OFF'}
          </span>

          <span className="hidden sm:inline-block text-[11px] font-mono font-medium tracking-tight">
            {network.online
              ? network.latency !== null
                ? `${network.latency}ms`
                : ''
              : 'Offline'}
          </span>
        </div>

        {/* Live status dot */}
        <span
          className={cn(
            'size-1.5 rounded-full shrink-0',
            network.online
              ? network.generation === '5G'
                ? 'bg-cyan-400 animate-pulse'
                : network.strengthBars >= 3
                ? 'bg-emerald-400'
                : 'bg-amber-400'
              : 'bg-rose-500',
          )}
        />
      </button>

      {/* Popover Card */}
      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl text-foreground animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <Radio className={cn('size-4', getSignalColor(network.generation))} />
              <span className="text-xs font-bold uppercase tracking-wider">5G / 4G Network & Tower</span>
            </div>
            <button
              type="button"
              onClick={checkLatency}
              disabled={testing}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
              title="Test connection now"
            >
              <RefreshCw className={cn('size-3', testing && 'animate-spin text-primary')} />
              <span>{testing ? 'Checking…' : 'Test Ping'}</span>
            </button>
          </div>

          {/* Main Status Display */}
          <div className="p-4 space-y-3.5">
            {/* Status & Strength Banner */}
            <div
              className={cn(
                'flex items-center justify-between p-3.5 rounded-xl border transition-all',
                network.online
                  ? network.generation === '5G'
                    ? 'border-cyan-500/40 bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-800 dark:text-cyan-200'
                    : network.strengthBars >= 3
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {network.online ? (
                  network.generation === '5G' ? (
                    <div className="size-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-500 dark:text-cyan-300 shrink-0 font-bold font-mono text-xs shadow-inner">
                      5G
                    </div>
                  ) : (
                    <Wifi className="size-5 shrink-0 text-emerald-500" />
                  )
                ) : (
                  <WifiOff className="size-5 shrink-0 text-rose-500" />
                )}
                <div className="min-w-0">
                  <h4 className="text-xs font-bold leading-none flex items-center gap-1.5 truncate">
                    {network.online
                      ? `${network.generation} ${network.strengthLabel}`
                      : 'No Internet Access'}
                    {network.generation === '5G' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 tracking-wider uppercase">
                        Ultra Speed
                      </span>
                    )}
                  </h4>
                  <p className="text-[10px] opacity-80 mt-1 truncate">
                    {network.online
                      ? `Signal: ${network.strengthBars}/5 Bars · ${network.effectiveType.toUpperCase()}`
                      : 'Please check your WiFi or mobile data'}
                  </p>
                </div>
              </div>

              {/* 5-Step Tower Graphic */}
              <div className="flex items-end gap-[3px] h-5 px-1 shrink-0">
                <span className={cn('w-[3px] h-[5px] rounded-xs', getBarBg(1, network.strengthBars, network.generation))} />
                <span className={cn('w-[3px] h-[8px] rounded-xs', getBarBg(2, network.strengthBars, network.generation))} />
                <span className={cn('w-[3px] h-[11px] rounded-xs', getBarBg(3, network.strengthBars, network.generation))} />
                <span className={cn('w-[3px] h-[14px] rounded-xs', getBarBg(4, network.strengthBars, network.generation))} />
                <span className={cn('w-[3px] h-[17px] rounded-xs', getBarBg(5, network.strengthBars, network.generation))} />
              </div>
            </div>

            {/* Network Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl border border-border bg-muted/10 space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Activity className="size-3 text-primary" />
                  <span>Latency / Ping</span>
                </div>
                <div className="font-mono font-bold text-sm text-foreground">
                  {network.latency !== null ? `${network.latency} ms` : '—'}
                </div>
                <div className="text-[9px] text-muted-foreground font-medium">
                  {network.latency !== null
                    ? network.latency <= 75
                      ? '🚀 5G Ultra Fast'
                      : network.latency < 180
                      ? '⚡ 4G High Speed'
                      : network.latency < 400
                      ? '✓ Normal (3G)'
                      : '🐢 High latency'
                    : 'Unreachable'}
                </div>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/10 space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Zap className="size-3 text-amber-500" />
                  <span>Bandwidth Speed</span>
                </div>
                <div className="font-mono font-bold text-sm text-foreground">
                  {network.downlink ? `${network.downlink} Mbps` : network.generation}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  Band: {network.generation} (Broadband)
                </div>
              </div>
            </div>

            {/* Generation & Speed Ratings */}
            <div className="p-2.5 rounded-xl bg-muted/20 border border-border/70 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Generation:</span>
                <span className="font-bold font-mono text-foreground">{network.generation}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tower Signal Quality:</span>
                <span className="font-semibold text-foreground">{network.strengthLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Data Saver Mode:</span>
                <span className="font-medium text-foreground">
                  {network.saveData ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
                <span>Last Monitored:</span>
                <span className="font-mono text-foreground">
                  {network.lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
