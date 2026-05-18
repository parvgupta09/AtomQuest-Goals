'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { RoleGuard } from '@/components/RoleGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { GoalSheet, Goal } from '@/types'

export default function ManagerApprovalsPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const goalSheetId = params.id as string

  const [goalSheet, setGoalSheet] = useState<GoalSheet | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReturning, setIsReturning] = useState(false)

  // Edit dialog state
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [editTargetValue, setEditTargetValue] = useState('')
  const [editWeightage, setEditWeightage] = useState('')

  // Return dialog state
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [returnComment, setReturnComment] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const data: GoalSheet = await fetchWithAuth(`/goal-sheets/${goalSheetId}`)
        setGoalSheet(data)
        setGoals(data.goals || [])
      } catch (err) {
        if (err instanceof ApiError) {
          const message = typeof err.message === 'string' ? err.message : 'Failed to load goal sheet'
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
  }, [goalSheetId])

  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0)

  function openEditDialog(goal: Goal) {
    setEditingGoal(goal)
    setEditTargetValue(goal.target_value?.toString() || '')
    setEditWeightage(goal.weightage.toString())
  }

  async function handleSaveEdit() {
    if (!editingGoal) return

    const w = Number(editWeightage)
    if (w < 10 || w > 100) {
      toast({ title: 'Error', description: 'Weightage must be 10-100%', variant: 'destructive' })
      return
    }

    try {
      const updateData: any = {
        weightage: w,
      }

      if (editingGoal.target_value !== undefined) {
        updateData.target_value = Number(editTargetValue)
      }

      const updated: Goal = await fetchWithAuth(`/manager/goal-sheets/${goalSheetId}/goals/${editingGoal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      })

      setGoals(goals.map((g) => (g.id === updated.id ? updated : g)))
      setEditingGoal(null)

      toast({
        title: 'Success',
        description: 'Goal updated successfully',
      })
    } catch (err) {
      if (err instanceof ApiError) {
        toast({
          title: 'Error',
          description: err.message,
          variant: 'destructive',
        })
      }
    }
  }

  async function handleApprove() {
    if (!goalSheet) return

    setIsSubmitting(true)
    try {
      await fetchWithAuth(`/manager/goal-sheets/${goalSheetId}/approve`, {
        method: 'POST',
      })

      // Update local state immediately
      setGoalSheet(prev => prev ? { ...prev, status: 'approved' } : prev)

      toast({
        title: 'Success',
        description: 'Goals approved and locked successfully!',
      })

      setTimeout(() => {
        router.push('/manager/dashboard')
      }, 1500)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve goals'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReturn() {
    console.log('Sheet ID for return:', goalSheetId, 'type:', typeof goalSheetId)
    if (!goalSheetId || goalSheetId === 'undefined') {
      toast({ title: 'Error', description: 'Invalid page — please go back and try again', variant: 'destructive' })
      return
    }

    if (!returnComment.trim()) {
      toast({ title: 'Error', description: 'Please enter feedback', variant: 'destructive' })
      return
    }

    const url = `/manager/goal-sheets/${goalSheetId}/return`
    console.log('Calling URL:', url)

    setIsReturning(true)
    try {
      await fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify({ comment: returnComment }),
      })

      setGoalSheet(prev => prev ? { ...prev, status: 'returned' } : prev)
      setShowReturnDialog(false)

      toast({
        title: 'Success',
        description: 'Goal sheet returned for rework!',
      })

      setTimeout(() => {
        router.push('/manager/dashboard')
      }, 1500)
    } catch (err: any) {
      const msg = err?.message || err?.detail || 'Failed to return goal sheet'
      toast({
        title: 'Error',
        description: typeof msg === 'string' ? msg : JSON.stringify(msg),
        variant: 'destructive',
      })
    } finally {
      setIsReturning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-12">
          <Spinner className="w-8 h-8" />
        </div>
      </div>
    )
  }

  if (!goalSheet) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <p>Goal sheet not found</p>
            <Link href="/manager/dashboard">
              <Button className="mt-4">Back to Dashboard</Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <RoleGuard allowedRoles={['manager', 'admin']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Review Goal Sheet</h1>
                  <p className="text-gray-600 mt-1">Submitted {new Date(goalSheet.submitted_at || '').toLocaleDateString()}</p>
                </div>
                <Link href="/manager/dashboard">
                  <Button variant="outline">Back</Button>
                </Link>
              </div>
            </div>

            {/* Employee Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Employee Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 uppercase">Employee</p>
                    <p className="font-medium">{goalSheet.employee?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase">Department</p>
                    <p className="font-medium">{goalSheet.employee?.department || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase">Status</p>
                    {(() => {
                      const statusConfig: Record<string, { label: string; className: string }> = {
                        submitted: { label: 'Pending Review', className: 'bg-amber-100 text-amber-800' },
                        approved: { label: 'Already Approved', className: 'bg-green-100 text-green-800' },
                        returned: { label: 'Returned for Rework', className: 'bg-red-100 text-red-800' },
                        draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
                      }
                      const cfg = statusConfig[goalSheet.status] || statusConfig.draft
                      return <Badge className={cfg.className}>{cfg.label}</Badge>
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Goals Table */}
            <Card>
              <CardHeader>
                <CardTitle>Goals Review ({goals.length})</CardTitle>
                <CardDescription>Click edit to adjust target values or weightage</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Thrust Area</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="text-right">Weightage</TableHead>
                      <TableHead className="w-20">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goals.map((goal) => (
                      <TableRow key={goal.id}>
                        <TableCell className="font-medium">{goal.title}</TableCell>
                        <TableCell>{goal.thrust_area}</TableCell>
                        <TableCell>
                          {goal.target_date
                            ? new Date(goal.target_date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : goal.target_value}
                        </TableCell>
                        <TableCell className="text-right">{goal.weightage}%</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(goal)}
                            className="text-indigo-600 hover:text-indigo-700"
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Weightage</span>
                    <span className={`text-lg font-bold ${totalWeightage === 100 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalWeightage}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {goalSheet.status === 'submitted' && (
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => setShowReturnDialog(true)}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  disabled={isSubmitting || isReturning}
                >
                  Return for Rework
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={totalWeightage !== 100 || isSubmitting || isReturning}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                >
                  {isSubmitting ? 'Processing...' : 'Approve Goals'}
                </Button>
              </div>
            )}
            {goalSheet.status === 'approved' && (
              <div className="flex justify-end">
                <Badge className="bg-green-100 text-green-800 text-base px-4 py-2">
                  ✓ Already Approved
                </Badge>
              </div>
            )}
          </div>
        </main>

        {/* Edit Dialog */}
        <Dialog open={!!editingGoal} onOpenChange={(open) => !open && setEditingGoal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Goal</DialogTitle>
              <DialogDescription>{editingGoal?.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {editingGoal?.target_value !== undefined && (
                <div className="space-y-2">
                  <Label>Target Value</Label>
                  <Input
                    type="number"
                    value={editTargetValue}
                    onChange={(e) => setEditTargetValue(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Weightage (%)</Label>
                <Input
                  type="number"
                  min="10"
                  max="100"
                  value={editWeightage}
                  onChange={(e) => setEditWeightage(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditingGoal(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleSaveEdit}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Return Dialog */}
        <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return for Rework</DialogTitle>
              <DialogDescription>
                Provide feedback for the employee to improve their goals
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Feedback</Label>
                <Textarea
                  placeholder="Explain what needs to be revised..."
                  value={returnComment}
                  onChange={(e) => setReturnComment(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowReturnDialog(false)}
                  disabled={isReturning}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleReturn}
                  disabled={isReturning || !returnComment.trim()}
                >
                  {isReturning ? 'Returning...' : 'Return'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  )
}
