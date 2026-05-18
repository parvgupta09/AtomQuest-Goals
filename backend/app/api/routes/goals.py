from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.services.goal_service import GoalService
from app.services.manager_service import ManagerService
from app.schemas.goal_sheet import GoalSheetCreate, GoalSheetResponse
from app.schemas.goal import GoalCreate, GoalUpdate, GoalResponse, PushSharedGoalRequest, UpdateSharedGoalWeightageRequest

router = APIRouter()


@router.post("/goal-sheets", response_model=GoalSheetResponse, status_code=201)
async def create_goal_sheet(
    sheet_data: GoalSheetCreate,
    current_user = Depends(require_role("employee")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new goal sheet for current cycle (Employee only)."""
    sheet = await GoalService.create_goal_sheet(db, current_user.id, sheet_data.cycle_id)
    return sheet


@router.get("/goal-sheets/mine", response_model=list[GoalSheetResponse])
async def get_my_goal_sheets(
    current_user = Depends(require_role("employee")),
    db: AsyncSession = Depends(get_db),
):
    """Get my goal sheets (Employee only)."""
    sheets = await GoalService.get_my_goal_sheets(db, current_user.id)
    return sheets


@router.get("/goal-sheets/{id}", response_model=GoalSheetResponse)
async def get_goal_sheet(
    id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a goal sheet by ID with access control (Employee, Manager, Admin)."""
    sheet = await GoalService.get_goal_sheet_by_id(db, id, current_user)
    return sheet


@router.post("/goal-sheets/{id}/goals", response_model=GoalResponse, status_code=201)
async def add_goal(
    id: UUID,
    goal_data: GoalCreate,
    current_user = Depends(require_role("employee")),
    db: AsyncSession = Depends(get_db),
):
    """Add a goal to goal sheet (Employee only, pre-approval only)."""
    goal = await GoalService.add_goal(db, id, goal_data, current_user)
    return goal


@router.patch("/goal-sheets/{id}/goals/{goal_id}", response_model=GoalResponse)
async def update_goal(
    id: UUID,
    goal_id: UUID,
    goal_data: GoalUpdate,
    current_user = Depends(require_role("employee")),
    db: AsyncSession = Depends(get_db),
):
    """Edit a goal (Employee only, pre-approval only)."""
    goal = await GoalService.update_goal(db, goal_id, goal_data, current_user)
    return goal


@router.delete("/goal-sheets/{id}/goals/{goal_id}", status_code=204)
async def delete_goal(
    id: UUID,
    goal_id: UUID,
    current_user = Depends(require_role("employee")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a goal (Employee only, pre-approval only)."""
    await GoalService.delete_goal(db, goal_id, current_user)


@router.post("/goal-sheets/{id}/submit", response_model=GoalSheetResponse)
async def submit_goal_sheet(
    id: UUID,
    current_user = Depends(require_role("employee")),
    db: AsyncSession = Depends(get_db),
):
    """Submit goal sheet for manager approval (Employee only)."""
    sheet = await GoalService.submit_goal_sheet(db, id, current_user)
    return sheet


# Manager approval routes
@router.get("/manager/team-goals")
async def get_team_goals(
    current_user = Depends(require_role("manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get all goal sheets and pending approvals from direct reports (Manager only).

    Returns:
    {
        "pending": [sheets with status="submitted"],
        "all": [all sheets],
        "pending_count": number,
        "approved_count": number
    }
    """
    result = await ManagerService.get_team_goal_sheets(db, current_user.id)
    return result


@router.patch("/manager/goal-sheets/{id}/goals/{goal_id}", response_model=GoalResponse)
async def manager_edit_goal(
    id: UUID,
    goal_id: UUID,
    goal_data: GoalUpdate,
    current_user = Depends(require_role("manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Inline edit goal during review (Manager only)."""
    goal = await ManagerService.inline_edit_goal(db, id, goal_id, goal_data, current_user.id)
    return goal


@router.post("/manager/goal-sheets/{id}/approve", response_model=GoalSheetResponse)
async def approve_goal_sheet(
    id: UUID,
    current_user = Depends(require_role("manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Approve and lock goal sheet (Manager only)."""
    sheet = await ManagerService.approve_goal_sheet(db, id, current_user.id)
    return sheet


class ReturnGoalSheetRequest(BaseModel):
    comment: str = Field(..., min_length=1, max_length=2000)

@router.post("/manager/goal-sheets/{id}/return", response_model=GoalSheetResponse)
async def return_goal_sheet(
    id: UUID,
    request: ReturnGoalSheetRequest,
    current_user = Depends(require_role("manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Return goal sheet for rework (Manager only)."""
    sheet = await ManagerService.return_goal_sheet(db, id, current_user.id, request.comment)
    return sheet


@router.post("/admin/shared-goals")
async def push_shared_goal(
    request: PushSharedGoalRequest,
    current_user = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Push a goal to multiple employees (Admin or Manager only)."""
    result = await GoalService.push_shared_goals(
        db,
        current_user.id,
        request.thrust_area,
        request.title,
        request.description,
        request.uom_type.value,
        request.target_value,
        request.employee_ids
    )
    return {
        "message": f"Goal pushed to {len(result['success'])} employee(s)",
        "successful": len(result["success"]),
        "skipped": len(result["skipped"]),
        "skipped_reasons": {item["employee_id"]: [item.get("reason", "Unknown reason")] for item in result["skipped"]}
    }


@router.patch("/shared-goals/{goal_id}/weightage")
async def update_shared_goal_weightage(
    goal_id: UUID,
    request: UpdateSharedGoalWeightageRequest,
    current_user = Depends(require_role("employee")),
    db: AsyncSession = Depends(get_db),
):
    """Employee adjusts their weightage for shared goal."""
    goal = await GoalService.update_shared_goal_weightage(
        db,
        goal_id,
        current_user.id,
        request.weightage
    )
    return goal


@router.post("/admin/goal-sheets/{sheet_id}/unlock", response_model=GoalSheetResponse)
async def admin_unlock_goal_sheet(
    sheet_id: UUID,
    current_user = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin unlocks an approved goal sheet (Admin only)."""
    sheet = await ManagerService.admin_unlock_goal_sheet(db, sheet_id)
    return sheet
