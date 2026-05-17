'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { RoleGuard } from '@/components/RoleGuard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { GoalSheet } from '@/types'

export default function ManagerDashboardPage() {
  const { toast } = useToast()
  const [pendingGoals, setPendingGoals] = useState<any[]>([])
  const [allGoals, setAllGoals] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalTeamMembers: 0,
    pendingApprovals: 0,
    approvedCount: 0,
  })

  useEffect(() => {
    async function loadData() {
      try {
        const data: any = await fetchWithAuth('/manager/team-goals')

        setPendingGoals(data.pending || [])
        setAllGoals(data.all || [])

        // Get unique team members
        const uniqueIds = new Set((data.all || []).map((g: any) => g.employee_id))

        setStats({
          totalTeamMembers: uniqueIds.size,
          pendingApprovals: data.pending_count || 0,
          approvedCount: data.approved_count || 0,
        })
      } catch (err) {
        if (err instanceof ApiError) {
          const message = typeof err.message === 'string' ? err.message : 'Failed to load team goals'
          toast({
            title: 'Error',
            description: message,
            variant: 'destructive',
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'submitted':
        return 'bg-amber-100 text-amber-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'returned':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <RoleGuard allowedRoles={['manager', 'admin']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold">Manager Dashboard</h1>
                <p className="text-gray-600 mt-1">Manage your team's goals and approvals</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Team Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.totalTeamMembers}</p>
                  </CardContent>
                </Card>

                <Card className="border-amber-200 bg-amber-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-amber-900">Pending Approvals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-amber-700">{stats.pendingApprovals}</p>
                  </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-900">Approved</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-700">{stats.approvedCount}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Pending Approvals Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Pending Goal Approvals</CardTitle>
                  <CardDescription>Submitted goal sheets awaiting your review</CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingGoals.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No pending approvals</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead className="text-right">Goals</TableHead>
                          <TableHead className="w-20">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingGoals.map((goalSheet) => (
                          <TableRow key={goalSheet.id}>
                            <TableCell className="font-medium">{goalSheet.employee_name}</TableCell>
                            <TableCell>{goalSheet.employee_department}</TableCell>
                            <TableCell>
                              {new Date(goalSheet.submitted_at).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </TableCell>
                            <TableCell className="text-right">{goalSheet.goals_count || 0}</TableCell>
                            <TableCell>
                              <Link href={`/manager/approvals/${goalSheet.id}`}>
                                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                                  Review
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* All Goals Table */}
              <Card>
                <CardHeader>
                  <CardTitle>All Team Goals</CardTitle>
                  <CardDescription>Overview of all your team's goal sheets</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Goals</TableHead>
                        <TableHead className="w-20">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allGoals.map((goalSheet) => (
                        <TableRow key={goalSheet.id}>
                          <TableCell className="font-medium">{goalSheet.employee_name}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(goalSheet.status)}>
                              {goalSheet.status.charAt(0).toUpperCase() + goalSheet.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {goalSheet.submitted_at
                              ? new Date(goalSheet.submitted_at).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">{goalSheet.goals_count || 0}</TableCell>
                          <TableCell>
                            {goalSheet.status === 'submitted' && (
                              <Link href={`/manager/approvals/${goalSheet.id}`}>
                                <Button size="sm" variant="ghost" className="text-indigo-600">
                                  Review
                                </Button>
                              </Link>
                            )}
                            {goalSheet.status !== 'submitted' && (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </RoleGuard>
  )
}
