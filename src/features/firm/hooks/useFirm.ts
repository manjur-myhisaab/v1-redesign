import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sound } from '@/lib/sound'
import { firmApi } from '../api/firmApi'
import type { FirmListItem, FirmDetails, SwitchFirmResponse } from '../api/firmApi.types'
import { useAuth } from '@/context/auth/AuthContext'

export function useFirmsQuery() {
  return useQuery<FirmListItem[]>({
    queryKey: ['firms'],
    queryFn: async () => {
      const res = await firmApi.getAllFirms()
      if (res && res.success && Array.isArray(res.data)) {
        return res.data
      }
      return []
    },
  })
}

export function useFirmDetailsQuery() {
  return useQuery<FirmDetails>({
    queryKey: ['firm-details'],
    queryFn: async () => {
      const res = await firmApi.getFirmDetails()
      if (res && res.success && res.data) {
        return res.data
      }
      throw new Error(res?.message || 'Failed to fetch firm details')
    },
  })
}

export function useUpdateFirmMutation() {
  const queryClient = useQueryClient()
  const { activeWorkspace, setSession, token, user } = useAuth()
  
  return useMutation({
    mutationFn: async (data: Partial<FirmDetails>) => {
      const res = await firmApi.updateFirm(data)
      if (res && res.success && res.data) {
        return res.data
      }
      throw new Error(res?.message || 'Failed to update company details')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update company details')
    },
    onSuccess: (data: FirmDetails) => {
      toast.success('Company details updated successfully!')
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['firm-details'] })
      
      if (activeWorkspace && data.firm_name !== activeWorkspace.name) {
        const currentWorkspaces = JSON.parse(localStorage.getItem('mh.workspaces') || '[]')
        const updatedWorkspaces = currentWorkspaces.map((w: any) =>
          w.id === data.firm_id ? { ...w, name: data.firm_name } : w
        )
        setSession(token || '', user || { id: '', phone: '', name: '' }, updatedWorkspaces)
      }
    },
  })
}

export function useSwitchFirmMutation() {
  const { token, setSession } = useAuth()
  
  return useMutation({
    mutationFn: async (firmId: string) => {
      const res = await firmApi.switchFirm(firmId)
      if (res && res.success && res.data) {
        return res.data
      }
      throw new Error(res?.message || 'Failed to switch workspace')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error switching workspace')
    },
    onSuccess: (data: SwitchFirmResponse, _firmId: string) => {
      const activeWsId = data.current_firm_id
      const currentWorkspaces = JSON.parse(localStorage.getItem('mh.workspaces') || '[]')
      
      let updatedWorkspaces = [...currentWorkspaces]
      const activeIndex = updatedWorkspaces.findIndex(w => w.id === activeWsId)
      
      if (activeIndex > -1) {
        const [activeWs] = updatedWorkspaces.splice(activeIndex, 1)
        updatedWorkspaces = [activeWs, ...updatedWorkspaces]
      } else {
        // Fallback: if selected firm is not in workspaces list, try to find it
        updatedWorkspaces = [
          { id: activeWsId, name: 'Active Firm', role: 'Owner' },
          ...updatedWorkspaces
        ]
      }
      
      const currentUser = JSON.parse(localStorage.getItem('mh.user') || '{}')
      const updatedUser = {
        ...currentUser,
        id: data.user_id || currentUser.id,
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || currentUser.name,
        phone: data.mobile_number || currentUser.phone
      }

      localStorage.setItem('mh.activeWs', activeWsId)
      setSession(token || '', updatedUser, updatedWorkspaces)
      
      toast.success('Firm switched successfully!')
      window.location.reload()
    }
  })
}
