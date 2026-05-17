'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { RoleGuard } from '@/components/RoleGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { GoalSheet, CreateGoalInput } from '@/types'

export default function GoalsEditPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const goalSheetId = params.id as string

  const [goalSheet, setGoalSheet] = useState<GoalSheet | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [thrustArea, setThrustArea] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uomType, setUomType] = useState<'numeric_min' | 'numeric_max' | 'timeline' | 'zero'>('numeric_min')
  const [targetValue, setTargetValue] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [weightage, setWeightage] = useState('')

  const [goals, setGoals] = useState<any[]>([])

  useEffect(() => {
    async function loadGoalSheet() {
      try {
        const sheet: GoalSheet = await fetchWithAuth(`/goal-sheets/${goalSheetId}`)
        setGoalSheet(sheet)
        setGoals(sheet.goals || [])

        if (sheet.status !== 'returned') {
          toast({
            title: 'Info',
            description: 'Only returned goal sheets can be edited',
            variant: 'default',
          })
          router.push('/dashboard')
        }
      } catch (err) {
        if (err instanceof ApiError) {
          const message = typeof err.message === 'string' ? err.message : 'Failed to load goal sheet'
          toast({
            title: 'Error',
            description: message,
            variant: 'destructive',
          })
        }
        router.push('/dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    loadGoalSheet()
  }, [goalSheetId])

  const totalWeightage = goals.reduce((sum, goal) => sum + (goal.weightage || 0), 0) + (weightage ? Number(weightage) : 0)

  const getWeightageColor = () => {
    if (totalWeightage === 100) return 'text-green-600'
    if (totalWeightage > 100) return 'text-red-600'
    return 'text-gray-600'
  }

  async function handleAddGoal() {
    if (!goalSheet) return

    // Validation
    if (!thrustArea.trim()) {
      toast({ title: 'Error', description: 'Thrust Area is required', variant: 'destructive' })
      return
    }
    if (!title.trim()) {
      toast({ title: 'Error', description: 'Goal Title is required', variant: 'destructive' })
      return
    }
    if (!weightage) {
      toast({ title: 'Error', description: 'Weightage is required', variant: 'destructive' })
      return
    }

    const w = Number(weightage)
    if (w < 10 || w > 100) {
      toast({ title: 'Error', description: 'Weightage must be between 10% and 100%', variant: 'destructive' })
      return
    }

    if (totalWeightage > 100) {
      toast({ title: 'Error', description: 'Total weightage cannot exceed 100%', variant: 'destructive' })
      return
    }

    if (goals.length >= 8) {
      toast({ title: 'Error', description: 'Maximum 8 goals per sheet', variant: 'destructive' })
      return
    }

    try {
      const goalData: CreateGoalInput = {
        thrust_area: thrustArea,
        title,
        description,
        uom_type: uomType,
        weightage: w,
      }

      if (uomType !== 'timeline' && uomType !== 'zero') {
        if (!targetValue) {
          toast({ title: 'Error', description: 'Target Value is required', variant: 'destructive' })
          return
        }
        goalData.target_value = Number(targetValue)
      } else if (uomType === 'timeline') {
        if (!targetDate) {
          toast({ title: 'Error', description: 'Target Date is required', variant: 'destructive' })
          return
        }
        goalData.target_date = targetDate
      }

      const newGoal = await fetchWithAuth(`/goal-sheets/${goalSheet.id}/goals`, {
        method: 'POST',
        body: JSON.stringify(goalData),
      })

      setGoals([...goals, newGoal])

      // Reset form
      setThrustArea('')
      setTitle('')
      setDescription('')
      setUomType('numeric_min')
      setTargetValue('')
      setTargetDate('')
      setWeightage('')

      toast({
        title: 'Success',
        description: 'Goal added successfully',
      })
    } catch (err) {
      if (err instanceof ApiError) {
        const message = typeof err.message === 'string' ? err.message : 'Failed to add goal'
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        })
      }
    }
  }

  async function handleDeleteGoal(goalId: string) {
    try {
      await fetchWithAuth(`/goal-sheets/${goalSheet?.id}/goals/${goalId}`, {
        method: 'DELETE',
      })
      setGoals(goals.filter((g) => g.id !== goalId))
      toast({
        title: 'Success',
        description: 'Goal deleted successfully',
      })
    } catch (err) {
      if (err instanceof ApiError) {
        const message = typeof err.message === 'string' ? err.message : 'Failed to delete goal'
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        })
      }
    }
  }

  async function handleSubmit() {
    if (!goalSheet) return

    if (goals.length === 0) {
      toast({ title: 'Error', description: 'Add at least one goal', variant: 'destructive' })
      return
    }

    const totalWeight = goals.reduce((sum, g) => sum + g.weightage, 0)
    if (totalWeight !== 100) {
      toast({ title: 'Error', description: 'Total weightage must equal exactly 100%', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      await fetchWithAuth(`/goal-sheets/${goalSheet.id}/submit`, {
        method: 'POST',
      })
      toast({
        title: 'Success',
        description: 'Goals resubmitted for approval',
      })
      router.push('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) {
        const message = typeof err.message === 'string' ? err.message : 'Failed to resubmit goals'
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        })
      }
    } finally {
      setIsSubmitting(false)
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
      <RoleGuard allowedRoles={['employee']}>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="max-w-4xl mx-auto px-4 py-8">
            <div className="text-center">
              <p>Goal sheet not found</p>
              <Link href="/dashboard">
                <Button className="mt-4">Back to Dashboard</Button>
              </Link>
            </div>
          </main>
        </div>
      </RoleGuard>
    )
  }

  return (
    <RoleGuard allowedRoles={['employee']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Edit & Resubmit Goals</h1>
              <p className="text-gray-600 mt-1">Update your goals based on manager feedback</p>
            </div>

            {/* Goal Form */}
            <Card>
              <CardHeader>
                <CardTitle>Add or Update a Goal</CardTitle>
                <CardDescription>Fill in the details for your goal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Thrust Area *</Label>
                    <Input
                      placeholder="e.g., Sales, Operations"
                      value={thrustArea}
                      onChange={(e) => setThrustArea(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Goal Title *</Label>
                    <Input
                      placeholder="e.g., Increase Revenue"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe your goal"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unit of Measure *</Label>
                    <Select value={uomType} onValueChange={(v) => setUomType(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="numeric_min">Numeric (Higher is Better)</SelectItem>
                        <SelectItem value="numeric_max">Numeric (Lower is Better)</SelectItem>
                        <SelectItem value="timeline">Timeline / Date</SelectItem>
                        <SelectItem value="zero">Zero (Binary)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {uomType !== 'timeline' && uomType !== 'zero' && (
                    <div className="space-y-2">
                      <Label>Target Value *</Label>
                      <Input
                        type="number"
                        placeholder="e.g., 100000"
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                      />
                    </div>
                  )}

                  {uomType === 'timeline' && (
                    <div className="space-y-2">
                      <Label>Target Date *</Label>
                      <Input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Weightage (%) *</Label>
                  <Input
                    type="number"
                    min="10"
                    max="100"
                    placeholder="10-100"
                    value={weightage}
                    onChange={(e) => setWeightage(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleAddGoal}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Add Goal
                  </Button>
                  <Link href="/dashboard">
                    <Button variant="outline">Cancel</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Weightage Counter */}
            <Card className={`border-2 ${totalWeightage === 100 ? 'border-green-200 bg-green-50' : totalWeightage > 100 ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Weightage Allocated</p>
                    <p className={`text-3xl font-bold ${getWeightageColor()}`}>
                      {totalWeightage}%
                    </p>
                  </div>
                  <div className="text-right">
                    {totalWeightage === 100 && (
                      <Badge className="bg-green-100 text-green-800">✓ Ready to Resubmit</Badge>
                    )}
                    {totalWeightage > 100 && (
                      <Badge className="bg-red-100 text-red-800">✗ Exceeds 100%</Badge>
                    )}
                    {totalWeightage < 100 && totalWeightage > 0 && (
                      <Badge className="bg-amber-100 text-amber-800">◯ {100 - totalWeightage}% Remaining</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Goals List */}
            {goals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Goals ({goals.length}/8)</CardTitle>
                  <CardDescription>Review and manage your added goals</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Thrust Area</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead className="text-right">Weightage</TableHead>
                        <TableHead className="w-12">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {goals.map((goal) => (
                        <TableRow key={goal.id}>
                          <TableCell className="font-medium">{goal.title}</TableCell>
                          <TableCell>{goal.thrust_area}</TableCell>
                          <TableCell>
                            {goal.target_date ? new Date(goal.target_date).toLocaleDateString() : goal.target_value}
                          </TableCell>
                          <TableCell className="text-right">{goal.weightage}%</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteGoal(goal.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              ✕
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <div className="flex gap-2 justify-end">
              <Link href="/dashboard">
                <Button variant="outline">Back</Button>
              </Link>
              <Button
                onClick={handleSubmit}
                disabled={goals.length === 0 || totalWeightage !== 100 || isSubmitting}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
              >
                {isSubmitting ? 'Resubmitting...' : 'Resubmit for Approval'}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  )
}
