'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { RoleGuard } from '@/components/RoleGuard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface AuditLog {
  id: string
  goal_id: string
  goal_title: string
  changed_by: string
  change_type: string
  old_value: Record<string, any>
  new_value: Record<string, any>
  changed_at: string
}

export default function AdminAuditLogPage() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadAuditLog() {
      try {
        const data: AuditLog[] = await fetchWithAuth('/reports/audit-log')
        setLogs(data || [])
      } catch (err) {
        if (err instanceof ApiError) {
          const message = 
            err?.response?.data?.detail ||
            (typeof err.message === 'string' ? err.message : 'Failed to load audit log')
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

    loadAuditLog()
  }, [toast])

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'create':
        return 'bg-green-100 text-green-800'
      case 'update':
        return 'bg-blue-100 text-blue-800'
      case 'delete':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
                  <h1 className="text-3xl font-bold">Audit Log</h1>
                  <p className="text-gray-600 mt-1">View all changes made to goals after approval</p>
                </div>
                <Link href="/admin/dashboard">
                  <Button variant="outline">Back</Button>
                </Link>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Post-Approval Changes</CardTitle>
                  <CardDescription>
                    All modifications to approved goals are tracked here for compliance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(logs?.length || 0) === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No audit entries yet. Changes to approved goals will appear here.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Goal</TableHead>
                            <TableHead>Change Type</TableHead>
                            <TableHead>Changed By</TableHead>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(logs || []).map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">{log.goal_title}</TableCell>
                              <TableCell>
                                <Badge className={getChangeTypeColor(log.change_type)}>
                                  {log.change_type.charAt(0).toUpperCase() + log.change_type.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell>{log.changed_by}</TableCell>
                              <TableCell>
                                {new Date(log.changed_at).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </TableCell>
                              <TableCell className="text-xs text-gray-600">
                                {Object.keys(log.new_value).length > 0 && (
                                  <span>
                                    {Object.entries(log.new_value)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(', ')}
                                  </span>
                                )}
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
