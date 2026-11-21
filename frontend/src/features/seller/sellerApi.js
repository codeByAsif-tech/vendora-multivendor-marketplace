import { baseApi } from '@/services/baseApi'
import { cleanParams } from '@/utils/format'

export const sellerApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ---- Store profile ----
    getMyStore: build.query({
      query: () => '/seller/profile',
      transformResponse: (response) => response.data.store,
      providesTags: ['MyStore'],
    }),
    saveMyStore: build.mutation({
      query: (body) => ({ url: '/seller/profile', method: 'PUT', body }),
      invalidatesTags: ['MyStore'],
    }),
    uploadStoreMedia: build.mutation({
      query: (formData) => ({ url: '/seller/profile/media', method: 'PUT', body: formData }),
      invalidatesTags: ['MyStore'],
    }),

    // ---- Products ----
    getSellerProducts: build.query({
      query: (params) => ({ url: '/seller/products', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['SellerProducts'],
    }),
    getSellerProduct: build.query({
      query: (id) => `/seller/products/${id}`,
      transformResponse: (response) => response.data.product,
      providesTags: (_result, _error, id) => [{ type: 'SellerProduct', id }],
    }),
    createProduct: build.mutation({
      query: (body) => ({ url: '/seller/products', method: 'POST', body }),
      invalidatesTags: ['SellerProducts', 'Inventory'],
    }),
    updateProduct: build.mutation({
      query: ({ id, ...body }) => ({ url: `/seller/products/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => ['SellerProducts', 'Inventory', { type: 'SellerProduct', id }],
    }),
    setProductVisibility: build.mutation({
      query: ({ id, isActive }) => ({ url: `/seller/products/${id}/visibility`, method: 'PATCH', body: { isActive } }),
      invalidatesTags: (_result, _error, { id }) => ['SellerProducts', { type: 'SellerProduct', id }],
    }),
    deleteProduct: build.mutation({
      query: (id) => ({ url: `/seller/products/${id}`, method: 'DELETE' }),
      invalidatesTags: ['SellerProducts', 'Inventory'],
    }),
    uploadProductImages: build.mutation({
      query: (formData) => ({ url: '/seller/uploads/product-images', method: 'POST', body: formData }),
      transformResponse: (response) => response.data.images,
    }),

    // ---- Inventory ----
    getInventory: build.query({
      query: (params) => ({ url: '/seller/inventory', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['Inventory'],
    }),
    getInventoryStats: build.query({
      query: () => '/seller/inventory/stats',
      transformResponse: (response) => response.data,
      providesTags: ['Inventory'],
    }),
    updateVariantStock: build.mutation({
      query: ({ productId, variantId, ...body }) => ({
        url: `/seller/inventory/${productId}/variants/${variantId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { productId }) => [
        'Inventory',
        'SellerProducts',
        { type: 'SellerProduct', id: productId },
      ],
    }),

    // ---- Orders (my shipments) ----
    getSellerOrders: build.query({
      query: (params) => ({ url: '/seller/orders', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['SellerOrders'],
    }),
    getSellerOrder: build.query({
      query: (id) => `/seller/orders/${id}`,
      transformResponse: (response) => response.data.order,
      providesTags: (_result, _error, id) => [{ type: 'SellerOrder', id }],
    }),
    updateSellerOrderStatus: build.mutation({
      query: ({ id, ...body }) => ({ url: `/seller/orders/${id}/status`, method: 'PATCH', body }),
      // Delivering a shipment adds an earning
      invalidatesTags: (_result, _error, { id }) => ['SellerOrders', 'Inventory', 'Wallet', 'Ledger', 'Analytics', { type: 'SellerOrder', id }],
    }),

    // ---- Returns ----
    getSellerReturns: build.query({
      query: (params) => ({ url: '/seller/returns', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['Returns'],
    }),
    decideSellerReturn: build.mutation({
      query: ({ id, ...body }) => ({ url: `/seller/returns/${id}`, method: 'PATCH', body }),
      // Receiving a return restocks items and reduces earnings
      invalidatesTags: ['Returns', 'Inventory', 'Wallet', 'Ledger'],
    }),

    // ---- Analytics ----
    getSellerAnalytics: build.query({
      query: (params) => ({ url: '/seller/analytics', params: cleanParams(params) }),
      transformResponse: (response) => response.data.report,
      providesTags: ['Analytics'],
    }),

    // ---- Earnings (read-only; payouts are recorded by admins) ----
    getMyWallet: build.query({
      query: () => '/seller/earnings',
      transformResponse: (response) => response.data.wallet,
      providesTags: ['Wallet'],
    }),
    getMyLedger: build.query({
      query: (params) => ({ url: '/seller/earnings/ledger', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['Ledger'],
    }),
    getMyPayouts: build.query({
      query: (params) => ({ url: '/seller/payouts', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
      providesTags: ['MyPayouts'],
    }),
  }),
})

export const {
  useGetSellerReturnsQuery,
  useDecideSellerReturnMutation,
  useGetSellerAnalyticsQuery,
  useGetMyWalletQuery,
  useGetMyLedgerQuery,
  useGetMyPayoutsQuery,
  useGetSellerOrdersQuery,
  useGetSellerOrderQuery,
  useUpdateSellerOrderStatusMutation,
  useGetMyStoreQuery,
  useSaveMyStoreMutation,
  useUploadStoreMediaMutation,
  useGetSellerProductsQuery,
  useGetSellerProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useSetProductVisibilityMutation,
  useDeleteProductMutation,
  useUploadProductImagesMutation,
  useGetInventoryQuery,
  useGetInventoryStatsQuery,
  useUpdateVariantStockMutation,
} = sellerApi
