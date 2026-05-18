'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { RoleGuard } from '@/components/RoleGuard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Check, X } from 'lucide-react'

interface CompletionData {
  total_employees: number
  submitted: number
  approved: number
  pending: number
  not_started: number
  goal_setting_status: EmployeeCompletionStatus[]
  quarterly_completion: Record<string, EmployeeQuarterlyCompletion[]>
}

interface EmployeeCompletionStatus {
  employee_id: string
  employee_name: string
  department: string
  manager_name: string | null
  status: 'not_started' | 'submitted' | 'approved'
  submitted_date: string | null
  approved_date: string | null
}

interface EmployeeQuarterlyCompletion {
  employee_id: string
  employee_name: string
  department: string
  q1_completed: boolean
  q2_completed: boolean
  q3_completed: boolean
  q4_completed: boolean
}

export default function AdminCompletionPage() {
  const { toast } = useToast()
  const [data, setData] = useState<CompletionData>({
    total_employees: 0,
    submitted: 0,
    approved: 0,
    pending: 0,
    not_started: 0,
    goal_setting_status: [],
    quarterly_completion: {
      q1: [],
      q2: [],
      q3: [],
      q4: []
    }
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadCompletionData() {
      try {
        const response: CompletionData = await fetchWithAuth('/reports/completion')
        setData(response)
      } catch (err) {
        let message = 'Failed to load completion data'
        if (err instanceof ApiError && typeof err.message === 'string') {
          message = err.message
        }
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadCompletionData()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>
      case 'submitted':
        return <Badge className="bg-amber-100 text-amber-800">Submitted</Badge>
      case 'not_started':
        return <Badge className="bg-red-100 text-red-800">Not Started</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>
    }
  }

  const getRowClassName = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-50 hover:bg-green-100 transition-colors'
      case 'submitted':
        return 'bg-amber-50 hover:bg-amber-100 transition-colors'
      case 'not_started':
        return 'bg-red-50 hover:bg-red-100 transition-colors'
      default:
        return 'hover:bg-gray-50 transition-colors'
    }
  }

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          ) : data && data.goal_setting_status?.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Completion Dashboard</h1>
                  <p className="text-gray-600 mt-1">Goal submission and approval status overview</p>
                </div>
                <Link href="/admin/dashboard">
                  <Button variant="outline">Back</Button>
                </Link>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Employees</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{data.total_employees}</p>
                  </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-900">Approved</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-700">{data.approved}</p>
                  </CardContent>
                </Card>

                <Card className="border-amber-200 bg-amber-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-amber-900">Submitted</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-amber-700">{data.submitted}</p>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-900">Pending</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-blue-700">{data.pending}</p>
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-900">Not Started</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-700">{data.not_started}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Goal Setting Status Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Goal Setting Status</CardTitle>
                  <CardDescription>Current submission and approval status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Manager</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead>Submitted Date</TableHead>
                          <TableHead>Approved Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.goal_setting_status.map((record) => (
                          <TableRow key={record.employee_id} className={getRowClassName(record.status)}>
                            <TableCell className="font-medium">{record.employee_name}</TableCell>
                            <TableCell>{record.department}</TableCell>
                            <TableCell>{record.manager_name || '-'}</TableCell>
                            <TableCell className="text-center">{getStatusBadge(record.status)}</TableCell>
                            <TableCell>
                              {record.submitted_date
                                ? new Date(record.submitted_date).toLocaleDateString()
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {record.approved_date
                                ? new Date(record.approved_date).toLocaleDateString()
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Quarterly Completion */}
              <Card>
                <CardHeader>
                  <CardTitle>Quarterly Completion Status</CardTitle>
                  <CardDescription>Goal completion by quarter</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="q1">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="q1">Q1</TabsTrigger>
                      <TabsTrigger value="q2">Q2</TabsTrigger>
                      <TabsTrigger value="q3">Q3</TabsTrigger>
                      <TabsTrigger value="q4">Q4</TabsTrigger>
                    </TabsList>

                    {['q1', 'q2', 'q3', 'q4'].map((quarter) => (
                      <TabsContent key={quarter} value={quarter} className="mt-4">
                        {data.quarterly_completion[quarter] && data.quarterly_completion[quarter].length > 0 ? (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Employee</TableHead>
                                  <TableHead>Department</TableHead>
                                  <TableHead className="text-center">Q1</TableHead>
                                  <TableHead className="text-center">Q2</TableHead>
                                  <TableHead className="text-center">Q3</TableHead>
                                  <TableHead className="text-center">Q4</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {data.quarterly_completion[quarter].map((record) => (
                                  <TableRow key={record.employee_id}>
                                    <TableCell className="font-medium">{record.employee_name}</TableCell>
                                    <TableCell>{record.department}</TableCell>
                                    <TableCell className="text-center">
                                      {record.q1_completed ? (
                                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                                      ) : (
                                        <X className="w-5 h-5 text-red-600 mx-auto" />
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {record.q2_completed ? (
                                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                                      ) : (
                                        <X className="w-5 h-5 text-red-600 mx-auto" />
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {record.q3_completed ? (
                                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                                      ) : (
                                        <X className="w-5 h-5 text-red-600 mx-auto" />
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {record.q4_completed ? (
                                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                                      ) : (
                                        <X className="w-5 h-5 text-red-600 mx-auto" />
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <Alert>
                            <AlertDescription>No completion data available for this quarter</AlertDescription>
                          </Alert>
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Alert>
              <AlertDescription>Unable to load completion data</AlertDescription>
            </Alert>
          )}
        </main>
      </div>
    </RoleGuard>
  )
}
