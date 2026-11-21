import { baseApi } from '@/services/baseApi'

/** In-app notifications for every role (customer, seller, admin). */
export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUnreadCount: build.query({
      query: () => '/notifications/unread-count',
      transformResponse: (response) => response.data.unreadCount,
      providesTags: ['Notifications'],
    }),
    getNotifications: build.query({
      query: (params) => ({ url: '/notifications', params }),
      transformResponse: (response) => response.data,
      providesTags: ['Notifications'],
    }),
    markNotificationRead: build.mutation({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),
    markAllNotificationsRead: build.mutation({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      invalidatesTags: ['Notifications'],
    }),
  }),
})

export const {
  useGetUnreadCountQuery,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi
