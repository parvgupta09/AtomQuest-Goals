'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { RoleGuard } from '@/components/RoleGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { GoalSheet, Goal, Achievement } from '@/types'

interface GoalWithAchievement extends Goal {
  achievement?: Achievement
}

interface GoalCycle {
  id: string
  phase: string
}

export default function AchievementsPage() {
  const { toast } = useToast()
  const [goalSheet, setGoalSheet] = useState<GoalSheet | null>(null)
  const [cycle, setCycle] = useState<GoalCycle | null>(null)
  const [goals, setGoals] = useState<GoalWithAchievement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)

  // Form state for achievements
  const [achievementValues, setAchievementValues] = useState<Record<string, string>>({})
  const [achievementStatuses, setAchievementStatuses] = useState<Record<string, string>>({})
  const [selectedPhase, setSelectedPhase] = useState('q1')

  useEffect(() => {
    async function loadData() {
      try {
        // Load active cycle to get current phase
        const activeCycle: GoalCycle = await fetchWithAuth('/cycles/active')
        setCycle(activeCycle)
        // Auto-select current phase so it matches the backend
        setSelectedPhase(activeCycle.phase)

        const sheets: GoalSheet[] = await fetchWithAuth('/goal-sheets/mine')
        if (sheets && sheets.length > 0) {
          const approved = sheets.find((s) => s.status === 'approved')
          if (approved) {
            const detail: GoalSheet = await fetchWithAuth(`/goal-sheets/${approved.id}`)
            setGoalSheet(detail)

            if (detail.goals) {
              // Load all achievements for the sheet using the correct endpoint
              let achievementMap: Record<string, Achievement> = {}
              try {
                const sheetAchievements: Achievement[] = await fetchWithAuth(
                  `/achievements/goal-sheets/${approved.id}/achievements`
                )
                if (sheetAchievements) {
                  sheetAchievements.forEach((a) => {
                    achievementMap[a.goal_id] = a
                  })
                }
              } catch {
                // no achievements yet is fine
              }

              const goalsWithAchievements: GoalWithAchievement[] = detail.goals.map((goal) => ({
                ...goal,
                achievement: achievementMap[goal.id],
              }))
              setGoals(goalsWithAchievements)

              // Initialize form state from existing achievements
              const values: Record<string, string> = {}
              const statuses: Record<string, string> = {}
              goalsWithAchievements.forEach((g) => {
                values[g.id] = g.achievement?.actual_value?.toString() || ''
                statuses[g.id] = g.achievement?.status || 'not_started'
              })
              setAchievementValues(values)
              setAchievementStatuses(statuses)
            }
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.status !== 404) {
          const message = typeof err.message === 'string' ? err.message : 'Failed to load achievements'
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

  async function handleSaveAchievement(goal: GoalWithAchievement) {
    const value = achievementValues[goal.id]
    const status = achievementStatuses[goal.id]

    if (!value && status === 'not_started') {
      toast({ title: 'Error', description: 'Enter actual value or change status', variant: 'destructive' })
      return
    }

    if (!cycle) {
      toast({ title: 'Error', description: 'Unable to determine current cycle', variant: 'destructive' })
      return
    }

    setIsSaving(goal.id)
    try {
      const today = new Date().toISOString().split('T')[0]
      const achievementData = {
        goal_id: goal.id,
        cycle_phase: selectedPhase,
        actual_value: value ? Number(value) : 0,
        actual_date: today,
        status,
      }

      console.log("Achievement payload", achievementData)

      const result: Achievement = await fetchWithAuth('/achievements', {
        method: 'POST',
        body: JSON.stringify(achievementData),
      })

      setGoals(
        goals.map((g) =>
          g.id === goal.id ? { ...g, achievement: result } : g,
        ),
      )

      const updated: GoalSheet = await fetchWithAuth(`/goal-sheets/${goalSheet.id}`)
      setGoalSheet(updated)

      toast({
        title: 'Success',
        description: 'Achievement logged successfully',
      })
    } catch (err) {
      let message = 'Failed to save achievement'
      if (err instanceof ApiError) {
        // Extract error message from various response formats
        if (err?.response?.data?.detail) {
          message = typeof err.response.data.detail === 'string' 
            ? err.response.data.detail 
            : JSON.stringify(err.response.data.detail)
        } else if (typeof err.message === 'string' && err.message !== 'ApiError') {
          message = err.message
        }
      } else if (err instanceof Error) {
        message = err.message
      }
      console.error("Achievement error", err)
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(null)
    }
  }

  const getProgressColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.5) return 'text-amber-600'
    return 'text-red-600'
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'on_track':
        return 'bg-amber-100 text-amber-800'
      case 'not_started':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
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

  if (!goalSheet || goalSheet.status !== 'approved') {
    return (
      <RoleGuard allowedRoles={['employee']}>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-8">
            <Card>
              <CardHeader>
                <CardTitle>Cannot Log Achievements</CardTitle>
                <CardDescription>
                  {!goalSheet ? 'No goal sheet found' : 'Goals must be approved before logging achievements'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">
                  {!goalSheet
                    ? 'Please create and submit a goal sheet first.'
                    : `Your goal sheet is currently ${goalSheet?.status}. Once your manager approves it, you'll be able to log your quarterly progress.`}
                </p>
                <Link href="/dashboard">
                  <Button className="bg-indigo-600 hover:bg-indigo-700">Back to Dashboard</Button>
                </Link>
              </CardContent>
            </Card>
          </main>
        </div>
      </RoleGuard>
    )
  }

  return (
    <RoleGuard allowedRoles={['employee']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Log Achievements</h1>
              <p className="text-gray-600 mt-1">Update your quarterly progress on approved goals</p>
            </div>

            {/* Phase Selector */}
            <Card className="bg-indigo-50 border-indigo-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Label className="font-semibold">Review Quarter:</Label>
                  <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="q1">Q1 (July)</SelectItem>
                      <SelectItem value="q2">Q2 (October)</SelectItem>
                      <SelectItem value="q3">Q3 (January)</SelectItem>
                      <SelectItem value="q4">Q4 (Annual)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-indigo-700">
                    Current cycle phase: <strong>{cycle?.phase?.replace('_', ' ').toUpperCase() || '—'}</strong>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Goals Cards */}
            <div className="grid gap-6">
              {goals.map((goal) => (
                <Card key={goal.id} className={goal.is_locked ? 'border-gray-200' : 'border-indigo-200'}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle>{goal.title}</CardTitle>
                        <CardDescription className="mt-2">
                          {goal.description}
                        </CardDescription>
                      </div>
                      <Badge className="bg-indigo-100 text-indigo-800">{goal.weightage}%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Goal Info */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-600 uppercase">Thrust Area</p>
                        <p className="font-medium">{goal.thrust_area}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 uppercase">UOM Type</p>
                        <p className="font-medium">{goal.uom_type.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 uppercase">Target</p>
                        <p className="font-medium">
                          {goal.target_date
                            ? new Date(goal.target_date).toLocaleDateString()
                            : goal.target_value}
                        </p>
                      </div>
                    </div>

                    {/* Achievement Form */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Actual Value</Label>
                          <Input
                            type="number"
                            placeholder="Enter actual value"
                            value={achievementValues[goal.id] || ''}
                            onChange={(e) =>
                              setAchievementValues({
                                ...achievementValues,
                                [goal.id]: e.target.value,
                              })
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            disabled={isSaving === goal.id}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select
                            value={achievementStatuses[goal.id] || 'not_started'}
                            onValueChange={(value) =>
                              setAchievementStatuses({
                                ...achievementStatuses,
                                [goal.id]: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_started">Not Started</SelectItem>
                              <SelectItem value="on_track">On Track</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {goal.achievement && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Progress Score</p>
                            <span className={`text-lg font-bold ${getProgressColor(goal.achievement.progress_score)}`}>
                              {(goal.achievement.progress_score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <Progress
                            value={Math.min(goal.achievement.progress_score * 100, 100)}
                            className="h-2"
                          />
                        </div>
                      )}

                      <Button
                        onClick={() => handleSaveAchievement(goal)}
                        disabled={isSaving === goal.id}
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isSaving === goal.id ? 'Saving...' : 'Save Progress'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  )
}
