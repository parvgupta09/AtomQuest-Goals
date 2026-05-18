'use client'

import { useEffect, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { User } from '@/types'

interface SharedGoalResponse {
  total_employees: number
  successful: number
  skipped: number
  skipped_reasons?: Record<string, string[]>
}

export default function AdminSharedGoalsPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectAll, setSelectAll] = useState(false)
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())

  // Form state
  const [thrustArea, setThrustArea] = useState('')
  const [goalTitle, setGoalTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uomType, setUomType] = useState<'numeric_min' | 'numeric_max' | 'timeline' | 'zero'>('numeric_max')
  const [targetValue, setTargetValue] = useState('')
  const [skippedReasons, setSkippedReasons] = useState<Record<string, string[]> | null>(null)

  useEffect(() => {
    async function loadEmployees() {
      try {
        const data: User[] = await fetchWithAuth('/users')
        const employees = data.filter((u) => u.role === 'employee')
        setUsers(employees)
      } catch (err) {
        if (err instanceof ApiError) {
          const message = typeof err.message === 'string' ? err.message : 'Failed to load employees'
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

    loadEmployees()
  }, [])

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees(new Set())
      setSelectAll(false)
    } else {
      const allIds = new Set(users.map((u) => u.id))
      setSelectedEmployees(allIds)
      setSelectAll(true)
    }
  }

  const handleEmployeeToggle = (employeeId: string) => {
    const newSelected = new Set(selectedEmployees)
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId)
    } else {
      newSelected.add(employeeId)
    }
    setSelectedEmployees(newSelected)
    setSelectAll(newSelected.size === users.length)
  }

  async function handleSubmit() {
    if (!thrustArea.trim() || !goalTitle.trim() || !description.trim() || !targetValue.trim()) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' })
      return
    }

    if (selectedEmployees.size === 0) {
      toast({ title: 'Error', description: 'Please select at least one employee', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      const response: SharedGoalResponse = await fetchWithAuth('/admin/shared-goals', {
        method: 'POST',
        body: JSON.stringify({
          thrust_area: thrustArea,
          title: goalTitle,
          description,
          uom_type: uomType,
          target_value: parseFloat(targetValue),
          employee_ids: Array.from(selectedEmployees),
        }),
      })

      setSkippedReasons(response.skipped_reasons || null)

      toast({
        title: 'Success',
        description: `Goal pushed to ${response.successful} employee${response.successful !== 1 ? 's' : ''}${
          response.skipped > 0 ? `. ${response.skipped} employee${response.skipped !== 1 ? 's' : ''} skipped.` : '.'
        }`,
      })

      // Reset form
      setThrustArea('')
      setGoalTitle('')
      setDescription('')
      setUomType('numeric_max')
      setTargetValue('')
      setSelectedEmployees(new Set())
      setSelectAll(false)
    } catch (err) {
      let message = 'Failed to push shared goal'
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

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="max-w-4xl mx-auto px-4 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Push Shared Goal</h1>
                  <p className="text-gray-600 mt-1">Create and push a shared goal to selected employees</p>
                </div>
                <Link href="/admin/dashboard">
                  <Button variant="outline">Back</Button>
                </Link>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Goal Details</CardTitle>
                  <CardDescription>Enter the goal information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Thrust Area *</Label>
                      <Input
                        placeholder="e.g., Sales Growth, Customer Satisfaction"
                        value={thrustArea}
                        onChange={(e) => setThrustArea(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Goal Title *</Label>
                      <Input
                        placeholder="e.g., Increase Q1 Revenue"
                        value={goalTitle}
                        onChange={(e) => setGoalTitle(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Textarea
                        placeholder="Describe the goal in detail"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isSubmitting}
                        className="resize-none"
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>UOM Type *</Label>
                        <Select value={uomType} onValueChange={(v) => setUomType(v as any)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="numeric_min">Numeric (Minimum)</SelectItem>
                            <SelectItem value="numeric_max">Numeric (Maximum)</SelectItem>
                            <SelectItem value="timeline">Timeline</SelectItem>
                            <SelectItem value="zero">Zero</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Target Value *</Label>
                        <Input
                          type="number"
                          placeholder="e.g., 100"
                          value={targetValue}
                          onChange={(e) => setTargetValue(e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Select Employees</CardTitle>
                  <CardDescription>Choose employees to receive this goal</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 p-3 border rounded-lg bg-gray-50">
                      <Checkbox
                        id="select-all"
                        checked={selectAll}
                        onCheckedChange={handleSelectAll}
                        disabled={isSubmitting || users.length === 0}
                      />
                      <Label htmlFor="select-all" className="cursor-pointer font-medium">
                        Select All ({users.length} employees)
                      </Label>
                    </div>

                    {users.length === 0 ? (
                      <Alert>
                        <AlertDescription>No employees found in the system</AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                        {users.map((employee) => (
                          <div
                            key={employee.id}
                            className="flex items-start space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <Checkbox
                              id={`employee-${employee.id}`}
                              checked={selectedEmployees.has(employee.id)}
                              onCheckedChange={() => handleEmployeeToggle(employee.id)}
                              disabled={isSubmitting}
                              className="mt-1"
                            />
                            <Label
                              htmlFor={`employee-${employee.id}`}
                              className="cursor-pointer flex-1"
                            >
                              <div className="font-medium">{employee.name}</div>
                              <div className="text-sm text-gray-600">{employee.department}</div>
                              <div className="text-xs text-gray-500">
                                Manager: {employee.manager_id ? (users.find(u => u.id === employee.manager_id)?.name || 'Unknown') : 'Unassigned'}
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-sm text-gray-600 pt-2">
                      {selectedEmployees.size} of {users.length} selected
                    </div>
                  </div>
                </CardContent>
              </Card>

              {skippedReasons && Object.keys(skippedReasons).length > 0 && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardHeader>
                    <CardTitle className="text-amber-900">Skipped Employees</CardTitle>
                    <CardDescription className="text-amber-800">
                      Some employees could not receive the goal
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(skippedReasons).map(([reason, employees]) => (
                        <div key={reason}>
                          <div className="font-medium text-amber-900">{reason}</div>
                          <div className="text-sm text-amber-800 ml-4">
                            {(employees as string[]).join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2 justify-end pt-4">
                <Link href="/admin/dashboard">
                  <Button variant="outline" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </Link>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Pushing...' : 'Push Goal'}
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </RoleGuard>
  )
}
