'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { RoleGuard } from '@/components/RoleGuard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { GoalCycle } from '@/types'

export default function AdminDashboardPage() {
  const { toast } = useToast()
  const [activeCycle, setActiveCycle] = useState<GoalCycle | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadActiveCycle() {
      try {
        const cycle: GoalCycle = await fetchWithAuth('/cycles/active')
        setActiveCycle(cycle)
      } catch (err) {
        // Silently handle if no active cycle - just show placeholder
        if (!(err instanceof ApiError && err.status === 404)) {
          console.error('Failed to load active cycle')
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadActiveCycle()
  }, [])

  const phaseLabels: Record<string, string> = {
    goal_setting: 'Goal Setting',
    q1: 'Q1 Review',
    q2: 'Q2 Review',
    q3: 'Q3 Review',
    q4: 'Q4 Review',
  }

  const menuItems = [
    {
      title: 'Manage Users',
      description: 'Create, edit, and manage users and roles',
      href: '/admin/users',
      icon: '👥',
    },
    {
      title: 'Goal Cycles',
      description: 'Configure goal-setting cycles and phases',
      href: '/admin/cycles',
      icon: '📅',
    },
    {
      title: 'Reports',
      description: 'View achievement reports and export data',
      href: '/admin/reports',
      icon: '📊',
    },
    {
      title: 'Audit Log',
      description: 'View all changes to goals post-approval',
      href: '/admin/audit-log',
      icon: '📋',
    },
    {
      title: 'Shared Goals',
      description: 'Push departmental KPIs to multiple employees',
      href: '/admin/shared-goals',
      icon: '🎯',
    },
    {
      title: 'Completion Dashboard',
      description: 'View goal submission and approval status',
      href: '/admin/completion',
      icon: '✅',
    },
    {
      title: 'Analytics',
      description: 'View organization-wide analytics and trends',
      href: '/admin/analytics',
      icon: '📈',
    },
  ]

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Manage users, cycles, and view organization-wide reports</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">-</p>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-900">Active Cycle</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <p className="text-lg font-semibold text-blue-700">Loading...</p>
                  ) : activeCycle ? (
                    <div>
                      <p className="text-xl font-bold text-blue-700">{phaseLabels[activeCycle.phase] || activeCycle.phase}</p>
                      <p className="text-xs text-blue-600 mt-1">{activeCycle.name}</p>
                    </div>
                  ) : (
                    <p className="text-lg font-semibold text-blue-700">No Active Cycle</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-amber-900">Pending Approvals</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-amber-700">-</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Links */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Management Tools</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {menuItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Card className="hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{item.title}</CardTitle>
                            <CardDescription className="mt-2 text-xs">{item.description}</CardDescription>
                          </div>
                          <div className="text-2xl ml-2">{item.icon}</div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                        >
                          Access <ArrowRight className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  )
}
