import { baseApi } from '@/services/baseApi'

/** Platform settings: public view for the storefront, full view + save for admins. */
export const settingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPublicSettings: build.query({
      query: () => '/settings',
      transformResponse: (response) => response.data.settings,
      providesTags: ['PlatformSettings'],
      keepUnusedDataFor: 600,
    }),
    getAdminSettings: build.query({
      query: () => '/admin/settings',
      transformResponse: (response) => response.data.settings,
      providesTags: ['PlatformSettings'],
    }),
    updateSettings: build.mutation({
      query: (body) => ({ url: '/admin/settings', method: 'PUT', body }),
      // Delivery terms changed: carts show new fees
      invalidatesTags: ['PlatformSettings', 'Cart'],
    }),
  }),
})

export const { useGetPublicSettingsQuery, useGetAdminSettingsQuery, useUpdateSettingsMutation } = settingsApi
