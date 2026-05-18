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
import type { GoalSheet, Goal } from '@/types'

interface EditableGoal extends Goal {
  isNew?: boolean
  isModified?: boolean
}

export default function GoalsEditPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const goalSheetId = params.id as string

  const [goalSheet, setGoalSheet] = useState<GoalSheet | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingGoal, setIsSavingGoal] = useState<string | null>(null)

  const [goals, setGoals] = useState<EditableGoal[]>([])
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)

  // Form state for new goal
  const [thrustArea, setThrustArea] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uomType, setUomType] = useState<'numeric_min' | 'numeric_max' | 'timeline' | 'zero'>('numeric_min')
  const [targetValue, setTargetValue] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [weightage, setWeightage] = useState('')

  useEffect(() => {
    async function loadGoalSheet() {
      try {
        const sheet: GoalSheet = await fetchWithAuth(`/goal-sheets/${goalSheetId}`)
        setGoalSheet(sheet)
        setGoals((sheet.goals || []).map(g => ({ ...g, isNew: false, isModified: false })))

        if (sheet.status !== 'returned') {
          toast({
            title: 'Info',
            description: 'Only returned goal sheets can be edited',
            variant: 'default',
          })
          router.push('/dashboard')
        }
      } catch (err) {
        const message = err instanceof ApiError 
          ? (err?.response?.data?.detail || (typeof err.message === 'string' ? err.message : 'Failed to load'))
          : 'Failed to load goal sheet'
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        })
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

  function updateGoalField(goalId: string, field: string, value: any) {
    setGoals(goals.map(g => 
      g.id === goalId 
        ? { ...g, [field]: value, isModified: true }
        : g
    ))
  }

  async function handleUpdateExistingGoal(goalId: string) {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return

    // Validate
    if (!goal.thrust_area?.trim() || !goal.title?.trim() || !goal.weightage) {
      toast({ title: 'Error', description: 'All required fields must be filled', variant: 'destructive' })
      return
    }

    if (goal.weightage < 10 || goal.weightage > 100) {
      toast({ title: 'Error', description: 'Weightage must be between 10% and 100%', variant: 'destructive' })
      return
    }

    setIsSavingGoal(goalId)
    try {
      const updateData = {
        thrust_area: goal.thrust_area,
        title: goal.title,
        description: goal.description,
        uom_type: goal.uom_type,
        weightage: goal.weightage,
      }

      if (goal.uom_type !== 'timeline' && goal.uom_type !== 'zero') {
        updateData.target_value = goal.target_value
      } else if (goal.uom_type === 'timeline') {
        updateData.target_date = goal.target_date
      }

      await fetchWithAuth(`/goal-sheets/${goalSheet?.id}/goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      })

      setGoals(goals.map(g =>
        g.id === goalId ? { ...g, isModified: false } : g
      ))
      setEditingGoalId(null)

      toast({
        title: 'Success',
        description: 'Goal updated successfully',
      })
    } catch (err) {
      const message = err instanceof ApiError 
        ? (err?.response?.data?.detail || (typeof err.message === 'string' ? err.message : 'Failed'))
        : 'Failed to update goal'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSavingGoal(null)
    }
  }

  async function handleAddGoal() {
    if (!goalSheet) return

    // Validation
    if (!thrustArea.trim() || !title.trim() || !weightage) {
      toast({ title: 'Error', description: 'All required fields must be filled', variant: 'destructive' })
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
      const goalData = {
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

      setGoals([...goals, { ...newGoal, isNew: true, isModified: false }])

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
      const message = err instanceof ApiError 
        ? (err?.response?.data?.detail || (typeof err.message === 'string' ? err.message : 'Failed'))
        : 'Failed to add goal'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
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
      const message = err instanceof ApiError 
        ? (err?.response?.data?.detail || (typeof err.message === 'string' ? err.message : 'Failed'))
        : 'Failed to delete goal'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    }
  }

  async function handleSubmit() {
    if (!goalSheet) return

    if (goals.length === 0) {
      toast({ title: 'Error', description: 'Add at least one goal', variant: 'destructive' })
      return
    }

    const totalWeight = goals.reduce((sum, g) => sum + (g.weightage || 0), 0)
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
      const message = err instanceof ApiError 
        ? (err?.response?.data?.detail || (typeof err.message === 'string' ? err.message : 'Failed'))
        : 'Failed to resubmit'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
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

            {/* Existing Goals - Editable */}
            {goals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Goals ({goals.length}/8)</CardTitle>
                  <CardDescription>Click any field to edit directly</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {goals.map((goal) => (
                      <div key={goal.id} className="p-4 border rounded-lg bg-white hover:bg-gray-50">
                        <div className="grid grid-cols-4 gap-4 mb-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Title *</Label>
                            <Input
                              value={goal.title}
                              onChange={(e) => updateGoalField(goal.id, 'title', e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Thrust Area *</Label>
                            <Input
                              value={goal.thrust_area}
                              onChange={(e) => updateGoalField(goal.id, 'thrust_area', e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">UOM Type *</Label>
                            <Select value={goal.uom_type} onValueChange={(v) => updateGoalField(goal.id, 'uom_type', v)}>
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="numeric_min">Numeric (↑)</SelectItem>
                                <SelectItem value="numeric_max">Numeric (↓)</SelectItem>
                                <SelectItem value="timeline">Timeline</SelectItem>
                                <SelectItem value="zero">Binary</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Weightage (%) *</Label>
                            <Input
                              type="number"
                              min="10"
                              max="100"
                              value={goal.weightage}
                              onChange={(e) => updateGoalField(goal.id, 'weightage', Number(e.target.value))}
                              className="text-sm"
                            />
                          </div>
                        </div>

                        {/* Target Value/Date Row */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Description</Label>
                            <Textarea
                              value={goal.description || ''}
                              onChange={(e) => updateGoalField(goal.id, 'description', e.target.value)}
                              className="text-sm"
                              rows={2}
                            />
                          </div>
                          <div className="space-y-2">
                            {goal.uom_type !== 'timeline' && goal.uom_type !== 'zero' && (
                              <div className="space-y-2">
                                <Label className="text-xs">Target Value *</Label>
                                <Input
                                  type="number"
                                  value={goal.target_value || ''}
                                  onChange={(e) => updateGoalField(goal.id, 'target_value', Number(e.target.value))}
                                  className="text-sm"
                                />
                              </div>
                            )}
                            {goal.uom_type === 'timeline' && (
                              <div className="space-y-2">
                                <Label className="text-xs">Target Date *</Label>
                                <Input
                                  type="date"
                                  value={goal.target_date ? goal.target_date.split('T')[0] : ''}
                                  onChange={(e) => updateGoalField(goal.id, 'target_date', e.target.value)}
                                  className="text-sm"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 justify-end">
                          {goal.isModified && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateExistingGoal(goal.id)}
                              disabled={isSavingGoal === goal.id}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {isSavingGoal === goal.id ? 'Saving...' : 'Save Changes'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add New Goal Form */}
            <Card>
              <CardHeader>
                <CardTitle>Add New Goal</CardTitle>
                <CardDescription>Add additional goals to your plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Thrust Area *</Label>
                    <Input
                      placeholder="e.g., Sales"
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
                    rows={2}
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
