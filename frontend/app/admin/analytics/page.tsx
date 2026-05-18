'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { RoleGuard } from '@/components/RoleGuard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface AnalyticsData {
  overall_completion_rate: number
  department_progress: DepartmentProgress[]
  goal_status_distribution: GoalStatusDistribution[]
  goals_by_thrust_area: ThrustAreaData[]
  top_performers: TopPerformer[]
}

interface DepartmentProgress {
  department: string
  avg_progress: number
}

interface GoalStatusDistribution {
  name: string
  value: number
}

interface ThrustAreaData {
  thrust_area: string
  count: number
}

interface TopPerformer {
  employee_id: string
  employee_name: string
  department: string
  avg_score: number
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444']
const THRUST_AREA_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4']

export default function AdminAnalyticsPage() {
  const { toast } = useToast()
  const [data, setData] = useState<AnalyticsData>({
    overall_completion_rate: 0,
    department_progress: [],
    goal_status_distribution: [],
    goals_by_thrust_area: [],
    top_performers: [],
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadAnalyticsData() {
      try {
        const response: AnalyticsData = await fetchWithAuth('/reports/analytics')
        setData(response)
      } catch (err) {
        let message = 'Failed to load analytics data'
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

    loadAnalyticsData()
  }, [toast])

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
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
                  <h1 className="text-3xl font-bold">Analytics</h1>
                  <p className="text-gray-600 mt-1">Organization-wide goal tracking and performance analytics</p>
                </div>
                <Link href="/admin/dashboard">
                  <Button variant="outline">Back</Button>
                </Link>
              </div>

              {/* Overall Completion Rate */}
              <Card className="border-indigo-200 bg-indigo-50">
                <CardHeader>
                  <CardTitle className="text-indigo-900">Overall Completion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <div className="text-5xl font-bold text-indigo-600">
                      {(data.overall_completion_rate ?? 0).toFixed(1)}%
                    </div>
                    <div className="ml-8 text-indigo-700">
                      <p className="text-sm">Goals completed successfully across the organization</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Department Progress Chart */}
              {data.department_progress.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Department Progress</CardTitle>
                    <CardDescription>Average progress by department</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.department_progress}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="department" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="avg_progress" fill="#6366f1" name="Average Progress (%)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Goal Status Distribution */}
                {data.goal_status_distribution.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Goal Status Distribution</CardTitle>
                      <CardDescription>Breakdown of goal statuses</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="w-full h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data.goal_status_distribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, value }) => `${name}: ${value}`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {data.goal_status_distribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Goals by Thrust Area */}
                {data.goals_by_thrust_area.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Goals by Thrust Area</CardTitle>
                      <CardDescription>Number of goals per thrust area</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="w-full h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.goals_by_thrust_area}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="thrust_area" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" fill="#8b5cf6" name="Goal Count" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Top Performers */}
              {data.top_performers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top Performers</CardTitle>
                    <CardDescription>Employees with highest average goal scores</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rank</TableHead>
                            <TableHead>Employee</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead className="text-right">Average Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.top_performers.map((performer, index) => (
                            <TableRow key={performer.employee_id}>
                              <TableCell>
                                <Badge
                                  className={
                                    index === 0
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : index === 1
                                        ? 'bg-gray-100 text-gray-800'
                                        : index === 2
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-blue-100 text-blue-800'
                                  }
                                >
                                  #{index + 1}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{performer.employee_name}</TableCell>
                              <TableCell>{performer.department}</TableCell>
                              <TableCell className="text-right">
                                <span className="font-semibold text-indigo-600">
                                  {performer.avg_score.toFixed(2)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!data.department_progress.length &&
                !data.goal_status_distribution.length &&
                !data.goals_by_thrust_area.length &&
                !data.top_performers.length && (
                  <Alert>
                    <AlertDescription>No analytics data available yet</AlertDescription>
                  </Alert>
                )}
            </div>
          )}
        </main>
      </div>
    </RoleGuard>
  )
}
