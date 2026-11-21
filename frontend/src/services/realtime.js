import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import { API_URL } from '@/config/app'
import { notificationsApi } from '@/features/notifications/notificationsApi'
import { baseApi } from './baseApi'

/**
 * Live updates (Socket.IO). The server pushes a `notification` event; we refresh the bell and the
 * lists it affects, and show a toast. If the socket is down, the bell falls back to polling.
 *
 * The socket uses the same short-lived access token as the API. When it expires the server closes the
 * socket; we make one API call (which refreshes the token through the normal 401 → refresh flow) and reconnect.
 */

/** Same origin in development (Vite proxies /socket.io); the API's origin when VITE_API_URL is absolute. */
const SOCKET_URL = /^https?:\/\//.test(API_URL) ? new URL(API_URL).origin : undefined

/** Which cached lists a notification type makes stale. */
const TAGS_BY_TYPE = [
  [/^(new_order|order_cancelled|order_status)$/, ['SellerOrders', 'SellerOrder', 'MyOrders', 'MyOrder', 'AdminOrders', 'AdminOrder', 'Analytics', 'Inventory']],
  [/^(payment_|refund_)/, ['MyOrders', 'MyOrder', 'AdminPayments', 'AdminPayment', 'Transactions']],
  [/^return_/, ['Returns', 'MyReturns', 'MyOrder', 'Inventory', 'Wallet', 'Ledger']],
  [/^payout_/, ['Wallet', 'Ledger', 'MyPayouts']],
  [/^product_/, ['SellerProducts', 'SellerProduct']],
  [/^store_/, ['MyStore']],
  [/^review_/, ['MyReview', 'Reviews']],
]

function tagsFor(type) {
  const extra = TAGS_BY_TYPE.find(([pattern]) => pattern.test(type))?.[1] ?? []
  return ['Notifications', ...extra]
}

let socket = null
let connected = false
let renewAttempts = 0
const subscribers = new Set()

function setConnected(value) {
  connected = value
  subscribers.forEach((notify) => notify())
}

/** For useSyncExternalStore: is the live connection up? */
export const realtimeStatus = {
  subscribe(callback) {
    subscribers.add(callback)
    return () => subscribers.delete(callback)
  },
  getSnapshot: () => connected,
}

/** Connects once per signed-in session. `store` is the Redux store. */
export function startRealtime(store) {
  if (socket) return

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    withCredentials: true,
    // Read the newest token on every (re)connect attempt.
    auth: (callback) => callback({ token: store.getState().auth.accessToken }),
    reconnectionDelayMax: 30_000,
  })

  // An API call refreshes an expired token (401 → /auth/refresh); then try again, at most 3 times in a row.
  async function renewAndReconnect() {
    if (renewAttempts >= 3 || !store.getState().auth.accessToken) return
    renewAttempts += 1
    await store.dispatch(notificationsApi.endpoints.getUnreadCount.initiate(undefined, { forceRefetch: true, subscribe: false }))
    setTimeout(() => socket?.connect(), 1000 * renewAttempts)
  }

  socket.on('connect', () => {
    renewAttempts = 0
    setConnected(true)
    // Catch up on anything missed while offline.
    store.dispatch(baseApi.util.invalidateTags(['Notifications']))
  })
  socket.on('disconnect', (reason) => {
    setConnected(false)
    if (reason === 'io server disconnect') renewAndReconnect() // token expired or account changed
  })
  socket.on('connect_error', (error) => {
    setConnected(false)
    if (error.message === 'UNAUTHORIZED') {
      socket.disconnect() // stop the automatic retries; renew first
      renewAndReconnect()
    }
  })

  socket.on('notification', (notification) => {
    store.dispatch(baseApi.util.invalidateTags(tagsFor(notification.type)))
    toast(notification.title, { icon: '🔔', id: notification._id })
  })
}

export function stopRealtime() {
  socket?.disconnect()
  socket = null
  renewAttempts = 0
  setConnected(false)
}
