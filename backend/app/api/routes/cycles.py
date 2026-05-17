from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.goal_cycle import GoalCycle
from app.schemas.goal_cycle import CycleCreate, CycleResponse

router = APIRouter(prefix="/cycles")

@router.get("", response_model=list[CycleResponse])
async def list_cycles(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all goal cycles."""
    stmt = select(GoalCycle).order_by(GoalCycle.opens_at.desc())
    result = await db.execute(stmt)
    cycles = result.scalars().all()
    return cycles

@router.get("/active", response_model=CycleResponse)
async def get_active_cycle(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the currently active goal cycle."""
    stmt = select(GoalCycle).where(GoalCycle.is_active == True)
    result = await db.execute(stmt)
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active cycle found"
        )
    return cycle

@router.post("", response_model=CycleResponse)
async def create_cycle(
    cycle_data: CycleCreate,
    current_user: dict = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new goal cycle (Admin only)."""
    cycle = GoalCycle(
        name=cycle_data.name,
        phase=cycle_data.phase,
        opens_at=cycle_data.opens_at,
        closes_at=cycle_data.closes_at,
    )
    db.add(cycle)
    await db.commit()
    await db.refresh(cycle)
    return cycle

@router.patch("/{cycle_id}", response_model=CycleResponse)
async def update_cycle(
    cycle_id: UUID,
    cycle_data: dict,
    current_user: dict = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Update a goal cycle (Admin only)."""
    stmt = select(GoalCycle).where(GoalCycle.id == cycle_id)
    result = await db.execute(stmt)
    cycle = result.scalar_one_or_none()

    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found"
        )

    for key, value in cycle_data.items():
        if hasattr(cycle, key) and value is not None:
            setattr(cycle, key, value)

    await db.commit()
    await db.refresh(cycle)
    return cycle

@router.post("/{cycle_id}/activate")
async def activate_cycle(
    cycle_id: UUID,
    current_user: dict = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Set a cycle as active (deactivates all others)."""
    # Deactivate all cycles
    stmt = select(GoalCycle).where(GoalCycle.is_active == True)
    result = await db.execute(stmt)
    active_cycles = result.scalars().all()
    for cycle in active_cycles:
        cycle.is_active = False

    # Activate the requested cycle
    stmt = select(GoalCycle).where(GoalCycle.id == cycle_id)
    result = await db.execute(stmt)
    cycle = result.scalar_one_or_none()

    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found"
        )

    cycle.is_active = True
    await db.commit()
    await db.refresh(cycle)
    return cycle
