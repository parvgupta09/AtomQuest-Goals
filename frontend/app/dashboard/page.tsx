'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { RoleGuard } from '@/components/RoleGuard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'
import type { GoalSheet, Goal, GoalCycle, CheckinComment } from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const user = getUser()
  const [goalSheet, setGoalSheet] = useState<GoalSheet | null>(null)
  const [cycle, setCycle] = useState<GoalCycle | null>(null)
  const [returnComment, setReturnComment] = useState<CheckinComment | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const cycleData: GoalCycle = await fetchWithAuth('/cycles/active')
        setCycle(cycleData)

        const sheetsData: GoalSheet[] = await fetchWithAuth('/goal-sheets/mine')
        if (sheetsData && sheetsData.length > 0) {
          const activeSheet = sheetsData.find((s: GoalSheet) => s.cycle_id === cycleData.id)
          if (activeSheet) {
            const sheetDetail: GoalSheet = await fetchWithAuth(`/goal-sheets/${activeSheet.id}`)
            setGoalSheet(sheetDetail)

            // Fetch return comment if status is returned
            if (sheetDetail.status === 'returned') {
              try {
                const checkins: CheckinComment[] = await fetchWithAuth(`/checkins/${activeSheet.id}`)
                if (checkins && checkins.length > 0) {
                  setReturnComment(checkins[checkins.length - 1])
                }
              } catch (err) {
                // Checkins not found is OK
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.status !== 404) {
          const message = typeof err.message === 'string' ? err.message : 'Failed to load data'
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
    <RoleGuard allowedRoles={['employee']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Welcome Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-3xl">Hello, {user?.name}</CardTitle>
                  <CardDescription>
                    {cycle ? `Current Cycle: ${cycle.name}` : 'No active cycle'}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Goal Sheet Status */}
              {goalSheet ? (
                <>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Goal Sheet Status</CardTitle>
                          <CardDescription>Your current goal sheet submission</CardDescription>
                        </div>
                        <Badge className={getStatusColor(goalSheet.status)}>
                          {goalSheet.status.charAt(0).toUpperCase() + goalSheet.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 uppercase">Created</p>
                          <p className="font-medium">
                            {new Date(goalSheet.created_at).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        {goalSheet.submitted_at && (
                          <div>
                            <p className="text-xs text-gray-600 uppercase">Submitted</p>
                            <p className="font-medium">
                              {new Date(goalSheet.submitted_at).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        )}
                      </div>

                      {goalSheet.status === 'draft' && (
                        <div className="flex gap-2 pt-4">
                          <Link href="/goals/create">
                            <Button className="bg-indigo-600 hover:bg-indigo-700">
                              Continue Editing
                            </Button>
                          </Link>
                        </div>
                      )}

                      {goalSheet.status === 'submitted' && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-amber-800 font-medium">
                            ⏳ Awaiting Manager Approval
                          </p>
                          <p className="text-amber-700 text-sm mt-1">
                            Your goals have been submitted for review. You'll receive an update once your manager responds.
                          </p>
                        </div>
                      )}

                      {goalSheet.status === 'returned' && (
                        <div className="space-y-3">
                          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-800 font-bold mb-2">⚠️ Returned for Rework</p>
                            <p className="text-red-700 text-sm mb-3">
                              Your manager has returned your goal sheet for revisions. Please review the feedback below.
                            </p>
                            {returnComment && (
                              <div className="mt-3 p-3 bg-white rounded border border-red-100">
                                <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Manager's Feedback</p>
                                <p className="text-red-800">{returnComment.comment}</p>
                                <p className="text-xs text-gray-500 mt-2">
                                  {new Date(returnComment.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            )}
                          </div>
                          <Link href={`/goals/edit/${goalSheet.id}`}>
                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                              Edit & Resubmit
                            </Button>
                          </Link>
                        </div>
                      )}

                      {goalSheet.status === 'approved' && (
                        <div className="space-y-3">
                          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-green-800 font-medium">✓ Goals Approved</p>
                            <p className="text-green-700 text-sm mt-1">
                              Your goals are locked and ready for tracking.
                            </p>
                          </div>
                          <Link href="/achievements">
                            <Button className="w-full bg-green-600 hover:bg-green-700">
                              Log Progress
                            </Button>
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Goals Table */}
                  {goalSheet.goals && goalSheet.goals.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Your Goals ({goalSheet.goals.length})</CardTitle>
                        <CardDescription>View and track your performance goals</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Title</TableHead>
                              <TableHead>Thrust Area</TableHead>
                              <TableHead className="text-right">Target</TableHead>
                              <TableHead className="text-right">Weightage</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {goalSheet.goals.map((goal: Goal) => (
                              <TableRow key={goal.id}>
                                <TableCell className="font-medium">{goal.title}</TableCell>
                                <TableCell>{goal.thrust_area}</TableCell>
                                <TableCell className="text-right">{goal.target_value}</TableCell>
                                <TableCell className="text-right">
                                  {goal.weightage === 0 ? (
                                    <span className="text-gray-400 text-sm">-</span>
                                  ) : (
                                    `${goal.weightage}%`
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {goal.is_locked ? (
                                    <Badge className="bg-gray-100 text-gray-800">🔒 Locked</Badge>
                                  ) : goalSheet.status === 'draft' ? (
                                    <Badge className="bg-blue-100 text-blue-800">Editable</Badge>
                                  ) : (
                                    <Badge className={getStatusColor(goalSheet.status)}>
                                      {goalSheet.status.charAt(0).toUpperCase() + goalSheet.status.slice(1)}
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>No Goal Sheet</CardTitle>
                    <CardDescription>Start by creating your goals for this cycle</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link href="/goals/create">
                      <Button className="bg-indigo-600 hover:bg-indigo-700">Create Goal Sheet</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>
    </RoleGuard>
  )
}
