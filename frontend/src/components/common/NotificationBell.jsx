import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/useAuth'
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '@/features/notifications/notificationsApi'
import { realtimeStatus } from '@/services/realtime'
import { cn } from '@/utils/cn'

/** Fallback: checks every minute only while the live connection is down. */
const POLL_MS = 60_000

function timeAgo(value) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

function NotificationList({ onNavigate }) {
  const { data, isLoading } = useGetNotificationsQuery({ limit: 15 })
  const [markRead] = useMarkNotificationReadMutation()
  const [markAll, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation()
  const navigate = useNavigate()

  function open(notification) {
    if (!notification.readAt) markRead(notification._id)
    if (notification.link) {
      navigate(notification.link)
      onNavigate()
    }
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Notifications</p>
        {data?.unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAll()}
            disabled={markingAll}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-10 text-brand-600">
            <Spinner className="size-5" />
          </div>
        ) : !data?.items.length ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">You are all caught up.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.items.map((n) => (
              <li key={n._id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn('flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50', !n.readAt && 'bg-brand-50/50')}
                >
                  <span
                    className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand-600')}
                    aria-label={n.readAt ? undefined : 'Unread'}
                  />
                  <span className="min-w-0">
                    <span className={cn('block text-sm text-slate-900', !n.readAt && 'font-semibold')}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/** Bell with unread badge; the list loads only when it is opened. */
export default function NotificationBell({ className }) {
  const { isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const live = useSyncExternalStore(realtimeStatus.subscribe, realtimeStatus.getSnapshot)
  const { data: unread = 0 } = useGetUnreadCountQuery(undefined, {
    skip: !isAuthenticated,
    pollingInterval: live ? 0 : POLL_MS,
    skipPollingIfUnfocused: true,
  })

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!isAuthenticated) return null

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] leading-4 font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-elevated"
        >
          <NotificationList onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
