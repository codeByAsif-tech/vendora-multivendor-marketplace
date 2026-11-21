import { baseApi } from '@/services/baseApi'

/** Writes the cart returned by a mutation straight into the getCart cache (no extra request). */
const syncCart = async (_arg, { dispatch, queryFulfilled }) => {
  try {
    const { data } = await queryFulfilled
    dispatch(shopApi.util.upsertQueryData('getCart', undefined, data))
  } catch {
    // errors are shown by the caller
  }
}

const syncWishlist = async (_arg, { dispatch, queryFulfilled }) => {
  try {
    const { data } = await queryFulfilled
    dispatch(shopApi.util.upsertQueryData('getWishlist', undefined, data))
  } catch {
    // errors are shown by the caller
  }
}

export const shopApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ---- Cart ----
    getCart: build.query({
      query: () => '/cart',
      transformResponse: (response) => response.data,
      providesTags: ['Cart'],
    }),
    addToCart: build.mutation({
      query: (body) => ({ url: '/cart/items', method: 'POST', body }),
      transformResponse: (response) => response.data,
      onQueryStarted: syncCart,
    }),
    updateCartItem: build.mutation({
      query: ({ itemId, quantity }) => ({ url: `/cart/items/${itemId}`, method: 'PATCH', body: { quantity } }),
      transformResponse: (response) => response.data,
      onQueryStarted: syncCart,
    }),
    removeCartItem: build.mutation({
      query: (itemId) => ({ url: `/cart/items/${itemId}`, method: 'DELETE' }),
      transformResponse: (response) => response.data,
      onQueryStarted: syncCart,
    }),

    // ---- Wishlist ----
    getWishlist: build.query({
      query: () => '/wishlist',
      transformResponse: (response) => response.data,
      providesTags: ['Wishlist'],
    }),
    addToWishlist: build.mutation({
      query: (productId) => ({ url: '/wishlist', method: 'POST', body: { productId } }),
      transformResponse: (response) => response.data,
      onQueryStarted: syncWishlist,
    }),
    removeFromWishlist: build.mutation({
      query: (productId) => ({ url: `/wishlist/${productId}`, method: 'DELETE' }),
      transformResponse: (response) => response.data,
      onQueryStarted: syncWishlist,
    }),

    // ---- Addresses ----
    getAddresses: build.query({
      query: () => '/addresses',
      transformResponse: (response) => response.data.addresses,
      providesTags: ['Addresses'],
    }),
    createAddress: build.mutation({
      query: (body) => ({ url: '/addresses', method: 'POST', body }),
      transformResponse: (response) => response.data.address,
      invalidatesTags: ['Addresses'],
    }),
    updateAddress: build.mutation({
      query: ({ id, ...body }) => ({ url: `/addresses/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Addresses'],
    }),
    setDefaultAddress: build.mutation({
      query: (id) => ({ url: `/addresses/${id}/default`, method: 'PATCH' }),
      invalidatesTags: ['Addresses'],
    }),
    deleteAddress: build.mutation({
      query: (id) => ({ url: `/addresses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Addresses'],
    }),

    // ---- Orders ----
    placeOrder: build.mutation({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      transformResponse: (response) => response.data.order,
      invalidatesTags: ['Cart', 'MyOrders'],
    }),
    getMyOrders: build.query({
      query: (params) => ({ url: '/orders', params }),
      transformResponse: (response) => response.data,
      providesTags: ['MyOrders'],
    }),
    getMyOrder: build.query({
      query: (orderNumber) => `/orders/${orderNumber}`,
      // returnWindowDays tells the order page until when delivered items can be returned
      transformResponse: (response) => ({ ...response.data.order, returnWindowDays: response.data.returnWindowDays }),
      providesTags: (_result, _error, orderNumber) => [{ type: 'MyOrder', id: orderNumber }],
    }),
    resubmitPayment: build.mutation({
      query: ({ orderNumber, utr }) => ({ url: `/orders/${orderNumber}/payment`, method: 'POST', body: { utr } }),
      invalidatesTags: (_result, _error, { orderNumber }) => ['MyOrders', { type: 'MyOrder', id: orderNumber }],
    }),
    cancelOrder: build.mutation({
      query: ({ orderNumber, ...body }) => ({ url: `/orders/${orderNumber}/cancel`, method: 'POST', body }),
      // Cart too: cancelling the only order brings back the first-order free delivery.
      invalidatesTags: (_result, _error, { orderNumber }) => ['Cart', 'MyOrders', { type: 'MyOrder', id: orderNumber }],
    }),

    // ---- Coupons ----
    applyCoupon: build.mutation({
      query: (code) => ({ url: '/cart/coupon', method: 'POST', body: { code } }),
      transformResponse: (response) => response.data,
      onQueryStarted: syncCart,
    }),
    removeCoupon: build.mutation({
      query: () => ({ url: '/cart/coupon', method: 'DELETE' }),
      transformResponse: (response) => response.data,
      onQueryStarted: syncCart,
    }),

    // ---- Returns ----
    getMyReturns: build.query({
      query: (params) => ({ url: '/returns', params }),
      transformResponse: (response) => response.data,
      providesTags: ['MyReturns'],
    }),
    requestReturn: build.mutation({
      query: ({ orderNumber, ...body }) => ({ url: `/orders/${orderNumber}/returns`, method: 'POST', body }),
      invalidatesTags: (_result, _error, { orderNumber }) => ['MyReturns', { type: 'MyOrder', id: orderNumber }],
    }),

    // ---- Reviews ----
    getProductReviews: build.query({
      query: ({ slug, ...params }) => ({ url: `/products/${slug}/reviews`, params }),
      transformResponse: (response) => response.data,
      providesTags: (_result, _error, { slug }) => [{ type: 'Reviews', id: slug }],
    }),
    getMyReview: build.query({
      query: (slug) => `/products/${slug}/reviews/me`,
      transformResponse: (response) => response.data,
      providesTags: (_result, _error, slug) => [{ type: 'MyReview', id: slug }],
    }),
    saveMyReview: build.mutation({
      query: ({ slug, ...body }) => ({ url: `/products/${slug}/reviews/me`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { slug }) => [{ type: 'Reviews', id: slug }, { type: 'MyReview', id: slug }],
    }),
    deleteMyReview: build.mutation({
      query: (slug) => ({ url: `/products/${slug}/reviews/me`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, slug) => [{ type: 'Reviews', id: slug }, { type: 'MyReview', id: slug }],
    }),
  }),
})

export const {
  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
  useGetWishlistQuery,
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation,
  useGetAddressesQuery,
  useCreateAddressMutation,
  useUpdateAddressMutation,
  useSetDefaultAddressMutation,
  useDeleteAddressMutation,
  usePlaceOrderMutation,
  useGetMyOrdersQuery,
  useGetMyOrderQuery,
  useCancelOrderMutation,
  useResubmitPaymentMutation,
  useApplyCouponMutation,
  useRemoveCouponMutation,
  useGetMyReturnsQuery,
  useRequestReturnMutation,
  useGetProductReviewsQuery,
  useGetMyReviewQuery,
  useSaveMyReviewMutation,
  useDeleteMyReviewMutation,
} = shopApi
