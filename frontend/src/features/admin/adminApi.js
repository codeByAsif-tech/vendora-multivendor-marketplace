import { baseApi } from '@/services/baseApi'
import { cleanParams } from '@/utils/format'

export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAdminOverview: build.query({
      query: () => '/admin/overview',
      transformResponse: (response) => response.data,
      providesTags: ['AdminOverview'],
    }),

    // ---- Sellers ----
    getAdminSellers: build.query({
      query: (params) => ({ url: '/admin/sellers', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['AdminSellers'],
    }),
    getAdminSeller: build.query({
      query: (id) => `/admin/sellers/${id}`,
      transformResponse: (response) => response.data.seller,
      providesTags: (_result, _error, id) => [{ type: 'AdminSeller', id }],
    }),
    updateSellerStatus: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/sellers/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => ['AdminSellers', 'AdminOverview', { type: 'AdminSeller', id }],
    }),

    // ---- Users ----
    getAdminUsers: build.query({
      query: (params) => ({ url: '/admin/users', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['AdminUsers'],
    }),
    updateUserStatus: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/users/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: ['AdminUsers'],
    }),

    // ---- Categories ----
    getAdminCategories: build.query({
      query: () => '/admin/categories',
      transformResponse: (response) => response.data.categories,
      providesTags: ['AdminCategories'],
    }),
    createCategory: build.mutation({
      query: (body) => ({ url: '/admin/categories', method: 'POST', body }),
      transformResponse: (response) => response.data.category,
      invalidatesTags: ['AdminCategories', 'CategoryTree'],
    }),
    updateCategory: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/categories/${id}`, method: 'PATCH', body }),
      transformResponse: (response) => response.data.category,
      invalidatesTags: ['AdminCategories', 'CategoryTree'],
    }),
    uploadCategoryImage: build.mutation({
      query: ({ id, formData }) => ({ url: `/admin/categories/${id}/image`, method: 'PUT', body: formData }),
      invalidatesTags: ['AdminCategories', 'CategoryTree'],
    }),
    deleteCategory: build.mutation({
      query: (id) => ({ url: `/admin/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AdminCategories', 'CategoryTree'],
    }),

    // ---- Products ----
    getAdminProducts: build.query({
      query: (params) => ({ url: '/admin/products', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['AdminProducts'],
    }),
    getAdminProduct: build.query({
      query: (id) => `/admin/products/${id}`,
      transformResponse: (response) => response.data.product,
      providesTags: (_result, _error, id) => [{ type: 'AdminProduct', id }],
    }),
    moderateProduct: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/products/${id}/moderation`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => ['AdminProducts', 'AdminOverview', { type: 'AdminProduct', id }],
    }),

    // ---- Orders ----
    getAdminOrders: build.query({
      query: (params) => ({ url: '/admin/orders', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['AdminOrders'],
    }),
    getAdminOrder: build.query({
      query: (id) => `/admin/orders/${id}`,
      transformResponse: (response) => response.data.order,
      providesTags: (_result, _error, id) => [{ type: 'AdminOrder', id }],
    }),
    adminUpdateShipmentStatus: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/seller-orders/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: ['AdminOrders', 'AdminOrder', 'AdminOverview', 'AdminPayments', 'AdminPayment', 'Transactions', 'Analytics'],
    }),

    // ---- Payments & transactions ----
    getAdminPayments: build.query({
      query: (params) => ({ url: '/admin/payments', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['AdminPayments'],
    }),
    getAdminPayment: build.query({
      query: (id) => `/admin/payments/${id}`,
      transformResponse: (response) => response.data.payment,
      providesTags: (_result, _error, id) => [{ type: 'AdminPayment', id }],
    }),
    verifyPayment: build.mutation({
      query: (id) => ({ url: `/admin/payments/${id}/verify`, method: 'POST' }),
      invalidatesTags: ['AdminPayments', 'AdminPayment', 'AdminOrders', 'AdminOrder', 'AdminOverview', 'Transactions'],
    }),
    rejectPayment: build.mutation({
      query: ({ id, reason }) => ({ url: `/admin/payments/${id}/reject`, method: 'POST', body: { reason } }),
      invalidatesTags: ['AdminPayments', 'AdminPayment', 'AdminOrders', 'AdminOrder', 'AdminOverview'],
    }),
    recordRefund: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/payments/${id}/refunds`, method: 'POST', body }),
      invalidatesTags: ['AdminPayments', 'AdminPayment', 'AdminOrders', 'AdminOrder', 'AdminOverview', 'Transactions'],
    }),
    getTransactions: build.query({
      query: (params) => ({ url: '/admin/transactions', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['Transactions'],
    }),

    // ---- Reviews ----
    getAdminReviews: build.query({
      query: (params) => ({ url: '/admin/reviews', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['AdminReviews'],
    }),
    moderateReview: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/reviews/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['AdminReviews', 'Reviews'],
    }),

    // ---- Coupons ----
    getCoupons: build.query({
      query: (params) => ({ url: '/admin/coupons', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['Coupons'],
    }),
    createCoupon: build.mutation({
      query: (body) => ({ url: '/admin/coupons', method: 'POST', body }),
      invalidatesTags: ['Coupons'],
    }),
    updateCoupon: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/coupons/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Coupons'],
    }),

    // ---- Returns ----
    getAdminReturns: build.query({
      query: (params) => ({ url: '/admin/returns', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['Returns'],
    }),
    decideAdminReturn: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/returns/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Returns', 'AdminPayments', 'AdminPayment', 'PayoutBalances'],
    }),

    // ---- Analytics ----
    getAdminAnalytics: build.query({
      query: (params) => ({ url: '/admin/analytics', params: cleanParams(params) }),
      transformResponse: (response) => response.data.report,
      providesTags: ['Analytics'],
    }),

    // ---- Commission & payouts ----
    getCommissionSettings: build.query({
      query: () => '/admin/settings/commission',
      transformResponse: (response) => response.data.settings,
      providesTags: ['CommissionSettings'],
    }),
    updateCommissionSettings: build.mutation({
      query: (body) => ({ url: '/admin/settings/commission', method: 'PUT', body }),
      invalidatesTags: ['CommissionSettings', 'PayoutBalances'],
    }),
    updateSellerCommission: build.mutation({
      query: ({ id, rate }) => ({ url: `/admin/sellers/${id}/commission`, method: 'PATCH', body: { rate } }),
      invalidatesTags: (_result, _error, { id }) => ['AdminSellers', 'PayoutBalances', { type: 'AdminSeller', id }],
    }),
    getPayoutBalances: build.query({
      query: (params) => ({ url: '/admin/payouts/balances', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['PayoutBalances'],
    }),
    getPayouts: build.query({
      query: (params) => ({ url: '/admin/payouts', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['Payouts'],
    }),
    createPayout: build.mutation({
      query: (body) => ({ url: '/admin/payouts', method: 'POST', body }),
      invalidatesTags: ['PayoutBalances', 'Payouts', 'AdminOverview'],
    }),
  }),
})

export const {
  useGetAdminReviewsQuery,
  useModerateReviewMutation,
  useGetCouponsQuery,
  useCreateCouponMutation,
  useUpdateCouponMutation,
  useGetAdminReturnsQuery,
  useDecideAdminReturnMutation,
  useGetAdminAnalyticsQuery,
  useGetCommissionSettingsQuery,
  useUpdateCommissionSettingsMutation,
  useUpdateSellerCommissionMutation,
  useGetPayoutBalancesQuery,
  useGetPayoutsQuery,
  useCreatePayoutMutation,
  useGetAdminPaymentsQuery,
  useGetAdminPaymentQuery,
  useVerifyPaymentMutation,
  useRejectPaymentMutation,
  useRecordRefundMutation,
  useGetTransactionsQuery,
  useGetAdminOrdersQuery,
  useGetAdminOrderQuery,
  useAdminUpdateShipmentStatusMutation,
  useGetAdminOverviewQuery,
  useGetAdminSellersQuery,
  useGetAdminSellerQuery,
  useUpdateSellerStatusMutation,
  useGetAdminUsersQuery,
  useUpdateUserStatusMutation,
  useGetAdminCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useUploadCategoryImageMutation,
  useDeleteCategoryMutation,
  useGetAdminProductsQuery,
  useGetAdminProductQuery,
  useModerateProductMutation,
} = adminApi
