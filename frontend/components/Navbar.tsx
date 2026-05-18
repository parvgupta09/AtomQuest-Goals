'use client'

import Link from 'next/link'
import { getUser, logout } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'

export function Navbar() {
  const [user, setUser] = useState(getUser())
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
    setUser(getUser())
  }, [])

  if (!isHydrated || !user) return null

  const roleColors: Record<string, string> = {
    employee: 'bg-blue-100 text-blue-800',
    manager: 'bg-purple-100 text-purple-800',
    admin: 'bg-red-100 text-red-800',
  }

  return (
    <nav className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-indigo-600">AtomQuest Goals</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Link href="/profile" className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">
              {user.name}
            </Link>
            <Badge className={roleColors[user.role] || 'bg-gray-100 text-gray-800'}>
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </Badge>
          </div>
          <Link href="/profile">
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-indigo-600">
              Profile
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Logout
          </Button>
        </div>
      </div>
    </nav>
  )
}
