import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useStore } from 'react-redux'
import FullPageLoader from '@/components/common/FullPageLoader'
import { bootstrapSession } from '@/features/auth/bootstrapSession'
import { useAuth } from '@/features/auth/useAuth'
import AppRouter from '@/routes/AppRouter'
import { startRealtime, stopRealtime } from '@/services/realtime'

export default function App() {
  const store = useStore()
  const { initialized, isAuthenticated } = useAuth()

  // Restore the session from the httpOnly refresh cookie on first load.
  useEffect(() => {
    bootstrapSession(store)
  }, [store])

  // Live updates while signed in; closed on logout.
  useEffect(() => {
    if (!isAuthenticated) return undefined
    startRealtime(store)
    return stopRealtime
  }, [isAuthenticated, store])

  return (
    <>
      {initialized ? <AppRouter /> : <FullPageLoader label="Loading your session…" />}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          className: '!rounded-xl !text-sm !font-medium !shadow-elevated',
        }}
      />
    </>
  )
}
