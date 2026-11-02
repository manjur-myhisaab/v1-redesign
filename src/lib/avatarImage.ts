import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Avatar from 'react-nice-avatar'
import { avatarConfig } from './avatarConfig'

// Rasterizes a react-nice-avatar (deterministic per seed) to an <img> so it can
// be drawn onto the canvas-based employees grid. Each seed is a self-contained
// inline SVG (same-origin data URL → does not taint the canvas).
const cache = new Map<string, HTMLImageElement>()
const SIZE = 48

export function avatarImage(
  seed: string,
  sex: 'man' | 'woman' | undefined,
  onLoad: () => void,
): HTMLImageElement | null {
  const key = `${seed}|${sex ?? ''}`
  const cached = cache.get(key)
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null

  const cfg = avatarConfig(seed, sex)
  const markup = renderToStaticMarkup(
    createElement(Avatar, {
      style: { width: '100%', height: '100%' },
      shape: 'circle',
      ...cfg,
    }),
  )
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">` +
    `<foreignObject width="${SIZE}" height="${SIZE}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${SIZE}px;height:${SIZE}px">${markup}</div>` +
    `</foreignObject></svg>`

  const img = new Image(SIZE, SIZE)
  img.onload = onLoad
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  cache.set(key, img)
  return null
}
