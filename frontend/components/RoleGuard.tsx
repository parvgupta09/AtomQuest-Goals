'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUser, getRoleRedirect, logout } from '@/lib/auth'
import { Spinner } from '@/components/ui/spinner'
import { fetchWithAuth, ApiError } from '@/lib/api'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: string[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function verifyAuth() {
      try {
        const user = getUser()

        if (!user) {
          router.push('/login')
          setIsLoading(false)
          return
        }

        if (!allowedRoles.includes(user.role)) {
          router.push(getRoleRedirect(user.role))
          setIsLoading(false)
          return
        }

        // Verify token is still valid by calling /auth/me
        try {
          await fetchWithAuth('/auth/me')
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            logout()
            return
          }
          // Other errors are non-fatal, allow page to load
        }

        setIsAuthorized(true)
        setIsLoading(false)
      } catch (err) {
        console.error('Auth verification failed:', err)
        logout()
      }
    }

    verifyAuth()
  }, [router, allowedRoles])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
