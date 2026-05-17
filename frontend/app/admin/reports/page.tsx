'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { RoleGuard } from '@/components/RoleGuard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface AchievementReport {
  employee_name: string
  goal_title: string
  target_value: number
  actual_value: number
  progress_score: number
  status: string
}

export default function AdminReportsPage() {
  const { toast } = useToast()
  const [report, setReport] = useState<AchievementReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    async function loadReport() {
      try {
        const data: AchievementReport[] = await fetchWithAuth('/reports/achievement')
        setReport(data)
      } catch (err) {
        if (err instanceof ApiError) {
          let message = 'Failed to load report'
          if (typeof err.message === 'string') {
            message = err.message
          } else if (err.message?.message) {
            message = err.message.message
          }
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

    loadReport()
  }, [])

  async function handleExportCSV() {
    setIsExporting(true)
    try {
      const data = await fetchWithAuth('/reports/achievement?export=csv')

      // Create blob and download
      const blob = new Blob([data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `achievement-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: 'Success',
        description: 'Report exported successfully',
      })
    } catch (err) {
      if (err instanceof ApiError) {
        toast({
          title: 'Error',
          description: err.message,
          variant: 'destructive',
        })
      }
    } finally {
      setIsExporting(false)
    }
  }

  const getProgressColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500'
    if (score >= 0.5) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const getStatusBadge = (status: string) => {
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
                  <h1 className="text-3xl font-bold">Achievement Reports</h1>
                  <p className="text-gray-600 mt-1">View goal achievements and progress across your organization</p>
                </div>
                <div className="flex gap-2">
                  <Link href="/admin/dashboard">
                    <Button variant="outline">Back</Button>
                  </Link>
                  <Button
                    onClick={handleExportCSV}
                    disabled={isExporting}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isExporting ? 'Exporting...' : '📥 Export CSV'}
                  </Button>
                </div>
              </div>

              {/* Summary Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Report Overview</CardTitle>
                  <CardDescription>Overall achievement metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Total Goals</p>
                      <p className="text-2xl font-bold">{report.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Completed</p>
                      <p className="text-2xl font-bold text-green-600">
                        {report.filter((r) => r.status === 'completed').length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">On Track</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {report.filter((r) => r.status === 'on_track').length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Avg Progress</p>
                      <p className="text-2xl font-bold">
                        {((report.reduce((sum, r) => sum + r.progress_score, 0) / report.length) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Report Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Achievement Details</CardTitle>
                  <CardDescription>Individual goal performance breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {report.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No achievement data available</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Goal</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Actual</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.employee_name}</TableCell>
                              <TableCell className="max-w-xs">{item.goal_title}</TableCell>
                              <TableCell className="text-right">{item.target_value}</TableCell>
                              <TableCell className="text-right">{item.actual_value}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={Math.min(item.progress_score * 100, 100)}
                                    className="w-24 h-2"
                                  />
                                  <span className="text-xs font-medium w-12 text-right">
                                    {(item.progress_score * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={getStatusBadge(item.status)}>
                                  {item.status.replace('_', ' ').charAt(0).toUpperCase() +
                                    item.status.replace('_', ' ').slice(1)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </RoleGuard>
  )
}
