import { ATTENDANCE_SERVER_URL } from '@/services/server'

const markerIconCache: Record<string, string> = {}

export const getFullAvatarUrl = (avatarUrl?: string | null): string => {
  if (!avatarUrl) {
    return 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
  }
  if (
    avatarUrl.startsWith('http://') ||
    avatarUrl.startsWith('https://') ||
    avatarUrl.startsWith('data:')
  ) {
    return avatarUrl
  }
  return `${ATTENDANCE_SERVER_URL}/assets/${avatarUrl}`
}

export const createMarkerIcon = async (
  avatarUrl: string | null | undefined,
  userId: string | number,
  isLive: boolean = true
): Promise<string | null> => {
  const cacheKey = `${userId}_${avatarUrl || 'default'}_${isLive ? 'live' : 'offline'}`
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
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 3
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()

    // 2. Load avatar image
    const src = getFullAvatarUrl(avatarUrl)
    const avatarImg = new Image()
    avatarImg.crossOrigin = 'anonymous'

    let imgLoaded = false
    try {
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Avatar load timeout')), 3000)
        avatarImg.onload = () => {
          clearTimeout(timeoutId)
          imgLoaded = true
          resolve()
        }
        avatarImg.onerror = () => {
          clearTimeout(timeoutId)
          reject(new Error('Failed to load avatar image'))
        }
        avatarImg.src = src
      })
    } catch {
      imgLoaded = false
    }

    // 3. Draw clipped avatar
    ctx.save()
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2)
    ctx.clip()

    if (imgLoaded && avatarImg.width > 0 && avatarImg.height > 0) {
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
    ctx.lineWidth = 5
    ctx.stroke()

    const dataUrl = canvas.toDataURL()
    markerIconCache[cacheKey] = dataUrl
    return dataUrl
  } catch (error) {
    console.error('Error creating marker icon:', error)
    return null
  }
}
