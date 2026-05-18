'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { fetchWithAuth, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  department?: string
}

export default function ProfilePage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Password change form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const data: UserProfile = await fetchWithAuth('/users/me')
        setProfile(data)
      } catch (err) {
        const message = err instanceof ApiError
          ? (typeof err.message === 'string' ? err.message : 'Failed to load profile')
          : 'Failed to load profile'
        toast({ title: 'Error', description: message, variant: 'destructive' })
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
  }, [])

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()

    if (newPassword.length < 8) {
      toast({ title: 'Error', description: 'New password must be at least 8 characters', variant: 'destructive' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'New passwords do not match', variant: 'destructive' })
      return
    }

    setIsChangingPassword(true)
    try {
      await fetchWithAuth('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
      toast({ title: 'Success', description: 'Password changed successfully' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const message = err instanceof ApiError
        ? (typeof err.message === 'string' ? err.message : 'Failed to change password')
        : 'Failed to change password'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    manager: 'bg-blue-100 text-blue-800',
    employee: 'bg-green-100 text-green-800',
  }

  const roleDashboard: Record<string, string> = {
    admin: '/admin/dashboard',
    manager: '/manager/dashboard',
    employee: '/dashboard',
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Profile</h1>
              <p className="text-gray-600 mt-1">View your account details and change your password</p>
            </div>
            {profile && (
              <Link href={roleDashboard[profile.role] || '/dashboard'}>
                <Button variant="outline">← Back to Dashboard</Button>
              </Link>
            )}
          </div>

          {/* Profile Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your profile details on AtomQuest Goals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile ? (
                <>
                  {/* Avatar Circle */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                      {profile.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xl font-semibold">{profile.name}</p>
                      <Badge className={roleColors[profile.role] || 'bg-gray-100 text-gray-800'}>
                        {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Full Name</p>
                      <p className="font-medium">{profile.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Email Address</p>
                      <p className="font-medium">{profile.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Role</p>
                      <p className="font-medium capitalize">{profile.role}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Department</p>
                      <p className="font-medium">{profile.department || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">User ID</p>
                      <p className="font-mono text-sm text-gray-500">{profile.id}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">Profile not available</p>
              )}
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password. Minimum 8 characters required.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={isChangingPassword}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isChangingPassword}
                    required
                    minLength={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isChangingPassword}
                    required
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
