import { useState, useEffect, useCallback } from 'react'
import { geofencingApi } from '../api/geofencingApi'
import type { Geofence } from '../api/geofencingApi.types'

const GEOFENCE_ENABLED_KEY = 'mh.geofence.enabled'

export function useGeofencing() {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem(GEOFENCE_ENABLED_KEY)
    return saved !== null ? saved === 'true' : true
  })
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const setEnabled = (val: boolean) => {
    setEnabledState(val)
    localStorage.setItem(GEOFENCE_ENABLED_KEY, String(val))
  }

  const fetchGeofences = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await geofencingApi.getGeofences()
      // ensure res.data is an array or default to empty
      const list = Array.isArray(res.data) ? res.data : []
      setGeofences(list)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load geofences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGeofences()
  }, [fetchGeofences])

  const deleteGeofence = async (id: string) => {
    try {
      await geofencingApi.deleteGeofence(id)
      setGeofences((prev) => prev.filter((g) => (g.geo_fence_id || g.id) !== id))
      return true
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete geofence'
      setError(msg)
      throw new Error(msg)
    }
  }

  return {
    enabled,
    setEnabled,
    geofences,
    loading,
    error,
    refresh: fetchGeofences,
    deleteGeofence,
  }
}
