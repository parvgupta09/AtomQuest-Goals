export interface User {
  id: string
  name: string
  email: string
  role: 'employee' | 'manager' | 'admin'
  department: string
  manager_id: string | null
}

export interface GoalCycle {
  id: string
  name: string
  phase: string
  opens_at: string
  closes_at: string
  is_active: boolean
}

export interface GoalSheet {
  id: string
  employee_id: string
  cycle_id: string
  status: 'draft' | 'submitted' | 'approved' | 'returned'
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
  goals?: Goal[]
  employee?: {
    id: string
    name: string
    email: string
    role: 'employee' | 'manager' | 'admin'
    department: string | null
  }
}

export interface Goal {
  id: string
  goal_sheet_id: string
  thrust_area: string
  title: string
  description: string
  uom_type: 'numeric_min' | 'numeric_max' | 'timeline' | 'zero'
  target_value: number
  target_date: string | null
  weightage: number
  is_locked: boolean
  is_shared: boolean
  shared_by?: string | null
  created_at?: string
}

export interface Achievement {
  id: string
  goal_id: string
  cycle_phase: string
  actual_value: number
  actual_date?: string
  status: 'not_started' | 'on_track' | 'completed'
  progress_score: number
  updated_at?: string
}

export interface CheckinComment {
  id: string
  goal_sheet_id: string
  manager_id: string
  phase: string
  comment: string
  created_at: string
  manager_name?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface CreateGoalInput {
  thrust_area: string
  title: string
  description: string
  uom_type: 'numeric_min' | 'numeric_max' | 'timeline' | 'zero'
  target_value?: number
  target_date?: string
  weightage: number
}

export interface UpdateGoalInput {
  thrust_area?: string
  title?: string
  description?: string
  target_value?: number
  target_date?: string
  weightage?: number
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: 'employee' | 'manager' | 'admin'
  department: string
  manager_id?: string | null
}

export interface CreateGoalCycleInput {
  name: string
  phase: string
  opens_at: string
  closes_at: string
}
