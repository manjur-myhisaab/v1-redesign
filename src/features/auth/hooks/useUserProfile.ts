import { useQuery } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import type { UserProfileData } from '../api/authApi.types'

export const userProfileQueryKeys = {
  profile: ['userProfile'] as const,
}

export function useUserProfileQuery(enabled: boolean = true) {
  return useQuery<UserProfileData | null>({
    queryKey: userProfileQueryKeys.profile,
    queryFn: async () => {
      const res = await authApi.getUserProfile()
      if (res && res.success && res.data) {
        return res.data
      }
      return null
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
