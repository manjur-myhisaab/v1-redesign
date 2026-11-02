import { useEffect, useRef, useState, useCallback } from 'react'
import { ref, onValue, off, type DatabaseReference } from 'firebase/database'
import { database } from '@/config/firebase'
import type { ConnectionStatus, FirebaseRealtimeItem } from '../types'

export const useLiveTrackingFirebase = (firmId: string | null) => {
  const [realtimeDataMap, setRealtimeDataMap] = useState<Record<string, FirebaseRealtimeItem>>({})
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const listenerRef = useRef<DatabaseReference | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const subscribe = useCallback(() => {
    if (!firmId) {
      setConnectionStatus('error')
      return
    }

    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = now.getFullYear()
    const dateString = `${day}-${month}-${year}`

    const locationPath = `live_location/${firmId}/${dateString}`

    try {
      setConnectionStatus('connecting')

      if (listenerRef.current) {
        off(listenerRef.current)
        listenerRef.current = null
      }

      const dbRef = ref(database, locationPath)
      listenerRef.current = dbRef

      const unsubscribe = onValue(
        dbRef,
        (snapshot) => {
          setConnectionStatus('connected')
          if (snapshot.exists()) {
            const data = snapshot.val() || {}
            setRealtimeDataMap(data)
          } else {
            setRealtimeDataMap({})
          }
        },
        (error) => {
          console.error('Firebase tracking listener error:', error)
          setConnectionStatus('error')
        }
      )

      // Fallback timer so UI doesn't hang indefinitely on connecting
      const timer = setTimeout(() => {
        setConnectionStatus((prev) => (prev === 'connecting' ? 'connected' : prev))
      }, 1500)

      unsubscribeRef.current = () => {
        clearTimeout(timer)
        unsubscribe()
      }
    } catch (err) {
      console.error('Failed to initialize Firebase tracking listener:', err)
      setConnectionStatus('error')
    }
  }, [firmId])

  useEffect(() => {
    subscribe()

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      if (listenerRef.current) {
        off(listenerRef.current)
        listenerRef.current = null
      }
    }
  }, [subscribe])

  const refetch = useCallback(() => {
    subscribe()
  }, [subscribe])

  return {
    realtimeDataMap,
    connectionStatus,
    refetch,
  }
}
