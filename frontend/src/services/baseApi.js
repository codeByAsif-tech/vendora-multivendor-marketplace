import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { API_URL } from '@/config/app'
import { credentialsUpdated, loggedOut } from '@/features/auth/authSlice'
import { clearSession, markSession } from '@/features/auth/sessionHint'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  credentials: 'include', // send the httpOnly refresh cookie
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.accessToken
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

// Requests that must never trigger an automatic refresh.
const SKIP_REFRESH = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/register-seller',
  '/auth/refresh',
  '/auth/logout',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
])

// One refresh at a time: parallel 401s all wait for the same refresh request.
let refreshInFlight = null

export function refreshSession(api, extraOptions) {
  if (!refreshInFlight) {
    refreshInFlight = rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions)
      .then((result) => {
        if (result.data) {
          api.dispatch(credentialsUpdated(result.data.data))
          markSession()
        } else {
          clearSession()
        }
        return result
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

async function baseQueryWithReauth(args, api, extraOptions) {
  let result = await rawBaseQuery(args, api, extraOptions)

  const url = typeof args === 'string' ? args : args.url
  if (result.error?.status !== 401 || SKIP_REFRESH.has(url)) return result

  const refreshResult = await refreshSession(api, extraOptions)
  if (refreshResult.data) {
    result = await rawBaseQuery(args, api, extraOptions)
  } else {
    api.dispatch(loggedOut())
  }
  return result
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Me',
    'AdminOverview',
    'MyStore',
    'SellerProducts',
    'SellerProduct',
    'Inventory',
    'CategoryTree',
    'AdminCategories',
    'AdminSellers',
    'AdminSeller',
    'AdminUsers',
    'AdminProducts',
    'AdminProduct',
    'Cart',
    'Wishlist',
    'Addresses',
    'MyOrders',
    'MyOrder',
    'SellerOrders',
    'SellerOrder',
    'AdminOrders',
    'AdminOrder',
    'AdminPayments',
    'AdminPayment',
    'Transactions',
    'Wallet',
    'Ledger',
    'MyPayouts',
    'CommissionSettings',
    'PayoutBalances',
    'Payouts',
    'Analytics',
    'Reviews',
    'MyReview',
    'AdminReviews',
    'Coupons',
    'MyReturns',
    'Returns',
    'Notifications',
    'PlatformSettings',
  ],
  endpoints: () => ({}),
})
