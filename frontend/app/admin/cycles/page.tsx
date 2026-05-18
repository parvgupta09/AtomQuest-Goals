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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { GoalCycle, CreateGoalCycleInput } from '@/types'

export default function AdminCyclesPage() {
  const { toast } = useToast()
  const [cycles, setCycles] = useState<GoalCycle[]>([])
  const [activeCycle, setActiveCycle] = useState<GoalCycle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [phase, setPhase] = useState('goal_setting')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')

  // Phase update dialog state
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null)
  const [newPhase, setNewPhase] = useState('')

  useEffect(() => {
    async function loadCycles() {
      try {
        const data: GoalCycle[] = await fetchWithAuth('/cycles')
        setCycles(data)
        const active = data.find((c) => c.is_active)
        setActiveCycle(active || null)
      } catch (err) {
        if (err instanceof ApiError) {
          const message = typeof err.message === 'string' ? err.message : 'Failed to load cycles'
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

    loadCycles()
  }, [])

  async function handleCreateCycle() {
    if (!name.trim() || !opensAt || !closesAt) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      const cycleData: CreateGoalCycleInput = {
        name,
        phase,
        // Append seconds+Z so Pydantic receives a valid UTC ISO 8601 string
        opens_at: opensAt.length === 16 ? `${opensAt}:00.000Z` : opensAt,
        closes_at: closesAt.length === 16 ? `${closesAt}:00.000Z` : closesAt,
      }

      const newCycle: GoalCycle = await fetchWithAuth('/cycles', {
        method: 'POST',
        body: JSON.stringify(cycleData),
      })

      setCycles([...cycles, newCycle])
      setIsDialogOpen(false)

      // Reset form
      setName('')
      setPhase('goal_setting')
      setOpensAt('')
      setClosesAt('')

      toast({
        title: 'Success',
        description: 'Goal cycle created successfully',
      })
    } catch (err) {
      let message = 'Failed to create cycle'
      if (err instanceof ApiError && typeof err.message === 'string') {
        message = err.message
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const phaseLabels: Record<string, string> = {
    goal_setting: 'Goal Setting',
    q1: 'Q1 Review',
    q2: 'Q2 Review',
    q3: 'Q3 Review',
    q4: 'Q4 Review',
  }

  async function handleUpdatePhase() {
    if (!editingCycleId || !newPhase) {
      toast({ title: 'Error', description: 'Please select a phase', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      // Step 1: Update the phase
      const updatedCycle: GoalCycle = await fetchWithAuth(`/cycles/${editingCycleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ phase: newPhase }),
      })

      // Step 2: Activate this cycle (deactivates all others)
      const activatedCycle: GoalCycle = await fetchWithAuth(`/cycles/${editingCycleId}/activate`, {
        method: 'POST',
      })

      // Step 3: Update cycles list in state
      const updatedCycles = cycles.map((c) => 
        c.id === editingCycleId 
          ? { ...c, phase: newPhase, is_active: true } 
          : { ...c, is_active: false }
      )
      setCycles(updatedCycles)
      setActiveCycle(activatedCycle)
      setEditingCycleId(null)
      setNewPhase('')

      toast({
        title: 'Success',
        description: `Cycle phase updated to ${phaseLabels[newPhase]} and activated`,
      })
    } catch (err) {
      const message = err instanceof ApiError
        ? (typeof err.message === 'string' ? err.message : 'Failed to update cycle')
        : 'Failed to update cycle'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Goal Cycles</h1>
                  <p className="text-gray-600 mt-1">Create and manage goal-setting cycles</p>
                </div>
                <div className="flex gap-2">
                  <Link href="/admin/dashboard">
                    <Button variant="outline">Back</Button>
                  </Link>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-indigo-600 hover:bg-indigo-700">+ Create Cycle</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create New Goal Cycle</DialogTitle>
                        <DialogDescription>
                          Set up a new goal-setting or review cycle
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Cycle Name *</Label>
                          <Input
                            placeholder="e.g., FY2024 Q1"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Phase *</Label>
                          <Select value={phase} onValueChange={setPhase}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="goal_setting">Goal Setting</SelectItem>
                              <SelectItem value="q1">Q1 Review</SelectItem>
                              <SelectItem value="q2">Q2 Review</SelectItem>
                              <SelectItem value="q3">Q3 Review</SelectItem>
                              <SelectItem value="q4">Q4 Review</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Opens At *</Label>
                          <Input
                            type="datetime-local"
                            value={opensAt}
                            onChange={(e) => setOpensAt(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Closes At *</Label>
                          <Input
                            type="datetime-local"
                            value={closesAt}
                            onChange={(e) => setClosesAt(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>

                        <div className="flex gap-2 justify-end pt-4">
                          <Button
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                            disabled={isSubmitting}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="bg-indigo-600 hover:bg-indigo-700"
                            onClick={handleCreateCycle}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? 'Creating...' : 'Create'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Active Cycle Card */}
              {activeCycle && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Active Cycle</CardTitle>
                        <CardDescription className="mt-1">{activeCycle.name}</CardDescription>
                      </div>
                      <Badge className="bg-green-100 text-green-800">ACTIVE</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-green-700 uppercase">Phase</p>
                        <p className="font-medium text-green-900">{phaseLabels[activeCycle.phase]}</p>
                      </div>
                      <div>
                        <p className="text-xs text-green-700 uppercase">Opens</p>
                        <p className="font-medium text-green-900">
                          {new Date(activeCycle.opens_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-green-700 uppercase">Closes</p>
                        <p className="font-medium text-green-900">
                          {new Date(activeCycle.closes_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* All Cycles Table */}
              <Card>
                <CardHeader>
                  <CardTitle>All Goal Cycles ({cycles.length})</CardTitle>
                  <CardDescription>Manage your goal-setting cycles and phases</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead>Opens At</TableHead>
                        <TableHead>Closes At</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cycles.map((cycle) => (
                        <TableRow key={cycle.id}>
                          <TableCell className="font-medium">{cycle.name}</TableCell>
                          <TableCell>{phaseLabels[cycle.phase]}</TableCell>
                          <TableCell>
                            {new Date(cycle.opens_at).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>
                            {new Date(cycle.closes_at).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            {cycle.is_active ? (
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex gap-2 justify-center">
                              {!cycle.is_active && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    setIsSubmitting(true)
                                    try {
                                      const activatedCycle: GoalCycle = await fetchWithAuth(`/cycles/${cycle.id}/activate`, {
                                         method: 'POST',
                                       })
                                      const updatedCycles = cycles.map((c) =>
                                        c.id === cycle.id ? { ...c, is_active: true } : { ...c, is_active: false }
                                      )
                                      setCycles(updatedCycles)
                                      setActiveCycle(activatedCycle)
                                      toast({
                                        title: 'Success',
                                        description: 'Cycle activated',
                                      })
                                    } catch (err) {
                                      const message = err instanceof ApiError
                                        ? (typeof err.message === 'string' ? err.message : 'Failed to activate cycle')
                                        : 'Failed to activate cycle'
                                      toast({
                                        title: 'Error',
                                        description: message,
                                        variant: 'destructive',
                                      })
                                    } finally {
                                      setIsSubmitting(false)
                                    }
                                  }}
                                  disabled={isSubmitting}
                                >
                                  Activate
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingCycleId(cycle.id)
                                  setNewPhase(cycle.phase)
                                }}
                                disabled={!cycle.is_active}
                              >
                                Update Phase
                              </Button>
                            </div>
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

        {/* Update Phase Dialog */}
        <Dialog open={!!editingCycleId} onOpenChange={(open) => !open && setEditingCycleId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Cycle Phase</DialogTitle>
              <DialogDescription>Select a new phase for this cycle</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Phase</Label>
                <Select value={newPhase} onValueChange={setNewPhase}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goal_setting">Goal Setting</SelectItem>
                    <SelectItem value="q1">Q1 Review</SelectItem>
                    <SelectItem value="q2">Q2 Review</SelectItem>
                    <SelectItem value="q3">Q3 Review</SelectItem>
                    <SelectItem value="q4">Q4 Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditingCycleId(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleUpdatePhase}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  )
}

