import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Avatar from 'react-nice-avatar'
import { avatarConfig } from '@/lib/avatarConfig'
import { ATTENDANCE_SERVER_URL } from '@/services/server'

const markerIconCache: Record<string, string> = {}

export const getFullAvatarUrl = (avatarUrl?: any): string | null => {
  if (!avatarUrl) return null

  let cleanStr = ''
  if (typeof avatarUrl === 'object' && avatarUrl !== null) {
    cleanStr = avatarUrl.id || avatarUrl.filename_disk || avatarUrl.url || ''
  } else if (typeof avatarUrl === 'string') {
    cleanStr = avatarUrl.trim()
  }

  if (!cleanStr) return null

  // If it's a JSON string (e.g. react-nice-avatar config), return null so react-nice-avatar is rendered
  if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
    return null
  }

  // If it's already an absolute or data URL
  if (
    cleanStr.startsWith('http://') ||
    cleanStr.startsWith('https://') ||
    cleanStr.startsWith('data:') ||
    cleanStr.startsWith('blob:')
  ) {
    if (cleanStr.includes('pixabay.com')) return null
    return cleanStr
  }

  // Extract clean ID from Directus asset path
  const cleanId = cleanStr.replace(/^.*\/assets\//, '').replace(/^\/?assets\//, '')
  if (!cleanId || cleanId.length < 2) return null

  const token = localStorage.getItem('authToken') || localStorage.getItem('mh.token')
  const tokenParam = token ? `?access_token=${encodeURIComponent(token)}` : ''
  return `${ATTENDANCE_SERVER_URL}/assets/${cleanId}${tokenParam}`
}

export const loadNiceAvatarImage = (seed: string, sex?: 'man' | 'woman'): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const SIZE = 150
    const cfg = avatarConfig(seed, sex)
    const markup = renderToStaticMarkup(
      createElement(Avatar, {
        style: { width: '100%', height: '100%' },
        shape: 'circle',
        ...cfg,
      })
    )
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">` +
      `<foreignObject width="${SIZE}" height="${SIZE}">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${SIZE}px;height:${SIZE}px">${markup}</div>` +
      `</foreignObject></svg>`

    const img = new Image(SIZE, SIZE)
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}

export const createMarkerIcon = async (
  avatarUrl: any,
  userId: string | number,
  isLive: boolean = true,
  fullName?: string
): Promise<string | null> => {
  const resolvedUrl = getFullAvatarUrl(avatarUrl)
  const seedName = (fullName || String(userId)).trim()
  const cacheKey = `${userId}_${resolvedUrl || 'nice-avatar'}_${isLive ? 'live' : 'offline'}_${seedName}`
  if (markerIconCache[cacheKey]) {
    return markerIconCache[cacheKey]
  }

  const size = 150
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  canvas.width = size
  canvas.height = size * 1.1

  try {
    // 1. Draw outer circle shadow
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 4
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()

    // 2. Load avatar: real photo if available, or react-nice-avatar
    let avatarImg: HTMLImageElement | null = null

    if (resolvedUrl) {
      const realImg = new Image()
      realImg.crossOrigin = 'anonymous'
      try {
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('Avatar load timeout')), 2500)
          realImg.onload = () => {
            clearTimeout(timeoutId)
            resolve()
          }
          realImg.onerror = () => {
            clearTimeout(timeoutId)
            reject(new Error('Failed to load avatar image'))
          }
          realImg.src = resolvedUrl
        })
        avatarImg = realImg
      } catch {
        avatarImg = null
      }
    }

    // If real photo is not available or failed to load, load react-nice-avatar
    if (!avatarImg || avatarImg.width === 0) {
      try {
        avatarImg = await loadNiceAvatarImage(seedName)
      } catch (err) {
        console.warn('Failed to rasterize nice avatar:', err)
      }
    }

    // 3. Draw clipped avatar inside circle
    ctx.save()
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2)
    ctx.clip()

    if (avatarImg && avatarImg.width > 0 && avatarImg.height > 0) {
      const aspectRatio = avatarImg.width / avatarImg.height
      let drawWidth = size
      let drawHeight = size
      let offsetX = 0
      let offsetY = 0

      if (aspectRatio > 1) {
        drawWidth = size * aspectRatio
        offsetX = -(drawWidth - size) / 2
      } else {
        drawHeight = size / aspectRatio
        offsetY = -(drawHeight - size) / 2
      }
      ctx.drawImage(avatarImg, offsetX, offsetY, drawWidth, drawHeight)
    } else {
      ctx.fillStyle = isLive ? '#10b981' : '#64748b'
      ctx.fillRect(0, 0, size, size)
    }
    ctx.restore()

    // 4. White inner ring
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.stroke()

    // 5. Status outer ring (Emerald for Live ON, Slate for Live OFF)
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
    ctx.strokeStyle = isLive ? '#10b981' : '#94a3b8'
    ctx.lineWidth = 6
    ctx.stroke()

    const dataUrl = canvas.toDataURL()
    markerIconCache[cacheKey] = dataUrl
    return dataUrl
  } catch (error) {
    console.error('Error creating marker icon:', error)
    return null
  }
}
