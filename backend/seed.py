#!/usr/bin/env python3
"""
AtomQuest seed script - populates database with test data
All test passwords: Demo@2026
"""

from dotenv import load_dotenv
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uuid import uuid4
from datetime import datetime, timedelta, timezone
import sys

load_dotenv()

# Use sync engine (replace asyncpg with psycopg2)
DATABASE_URL = os.getenv("DATABASE_URL", "").replace("postgresql+asyncpg", "postgresql")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not set in environment")

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# Use backend's hash function
from app.core.security import hash_password

# Import models
from app.models.user import User, UserRole
from app.models.goal_cycle import GoalCycle, CyclePhase
from app.models.goal_sheet import GoalSheet, GoalSheetStatus
from app.models.goal import Goal, UOMType
from app.models.achievement import Achievement
from app.models.audit_log import AuditLog

def clear_database():
    """Clear all tables."""
    from app.models.checkin_comment import CheckinComment
    session.query(Achievement).delete()
    session.query(CheckinComment).delete()
    session.query(Goal).delete()
    session.query(AuditLog).delete()
    session.query(GoalSheet).delete()
    session.query(GoalCycle).delete()
    session.query(User).delete()
    session.commit()
    print("[OK] Database cleared")

def create_users():
    """Create all test users."""
    hashed_password = hash_password("Demo@2026")

    users_data = [
        {
            "name": "Admin User",
            "email": "admin@atomquest.com",
            "role": UserRole.ADMIN,
            "department": "HR",
            "manager_id": None,
        },
        {
            "name": "Rajesh Kumar",
            "email": "manager1@atomquest.com",
            "role": UserRole.MANAGER,
            "department": "Sales",
            "manager_id": None,  # Reports to admin (will set after admin created)
        },
        {
            "name": "Priya Singh",
            "email": "manager2@atomquest.com",
            "role": UserRole.MANAGER,
            "department": "Marketing",
            "manager_id": None,  # Reports to admin
        },
        {
            "name": "Arjun Sharma",
            "email": "emp1@atomquest.com",
            "role": UserRole.EMPLOYEE,
            "department": "Sales",
            "manager_id": None,  # Reports to manager1 (will set after manager1 created)
        },
        {
            "name": "Sneha Patel",
            "email": "emp2@atomquest.com",
            "role": UserRole.EMPLOYEE,
            "department": "Sales",
            "manager_id": None,  # Reports to manager1
        },
        {
            "name": "Vikram Mehta",
            "email": "emp3@atomquest.com",
            "role": UserRole.EMPLOYEE,
            "department": "Marketing",
            "manager_id": None,  # Reports to manager2
        },
        {
            "name": "Kavya Nair",
            "email": "emp4@atomquest.com",
            "role": UserRole.EMPLOYEE,
            "department": "Marketing",
            "manager_id": None,  # Reports to manager2
        },
    ]

    users = {}

    # Create admin first
    admin = User(
        id=uuid4(),
        name=users_data[0]["name"],
        email=users_data[0]["email"],
        hashed_password=hashed_password,
        role=users_data[0]["role"].value,
        department=users_data[0]["department"],
    )
    session.add(admin)
    session.flush()
    users["admin"] = admin
    print(f"[OK] Created {admin.name}")

    # Create managers with admin as their manager
    manager1 = User(
        id=uuid4(),
        name=users_data[1]["name"],
        email=users_data[1]["email"],
        hashed_password=hashed_password,
        role=users_data[1]["role"].value,
        department=users_data[1]["department"],
        manager_id=admin.id,
    )
    session.add(manager1)
    session.flush()
    users["manager1"] = manager1
    print(f"[OK] Created {manager1.name}")

    manager2 = User(
        id=uuid4(),
        name=users_data[2]["name"],
        email=users_data[2]["email"],
        hashed_password=hashed_password,
        role=users_data[2]["role"].value,
        department=users_data[2]["department"],
        manager_id=admin.id,
    )
    session.add(manager2)
    session.flush()
    users["manager2"] = manager2
    print(f"[OK] Created {manager2.name}")

    # Create employees with managers
    emp1 = User(
        id=uuid4(),
        name=users_data[3]["name"],
        email=users_data[3]["email"],
        hashed_password=hashed_password,
        role=users_data[3]["role"].value,
        department=users_data[3]["department"],
        manager_id=manager1.id,
    )
    session.add(emp1)
    session.flush()
    users["emp1"] = emp1
    print(f"[OK] Created {emp1.name}")

    emp2 = User(
        id=uuid4(),
        name=users_data[4]["name"],
        email=users_data[4]["email"],
        hashed_password=hashed_password,
        role=users_data[4]["role"].value,
        department=users_data[4]["department"],
        manager_id=manager1.id,
    )
    session.add(emp2)
    session.flush()
    users["emp2"] = emp2
    print(f"[OK] Created {emp2.name}")

    emp3 = User(
        id=uuid4(),
        name=users_data[5]["name"],
        email=users_data[5]["email"],
        hashed_password=hashed_password,
        role=users_data[5]["role"].value,
        department=users_data[5]["department"],
        manager_id=manager2.id,
    )
    session.add(emp3)
    session.flush()
    users["emp3"] = emp3
    print(f"[OK] Created {emp3.name}")

    emp4 = User(
        id=uuid4(),
        name=users_data[6]["name"],
        email=users_data[6]["email"],
        hashed_password=hashed_password,
        role=users_data[6]["role"].value,
        department=users_data[6]["department"],
        manager_id=manager2.id,
    )
    session.add(emp4)
    session.flush()
    users["emp4"] = emp4
    print(f"[OK] Created {emp4.name}")

    session.commit()
    return users

def create_cycle():
    """Create a goal cycle."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    cycle = GoalCycle(
        id=uuid4(),
        name="FY 2026 Annual Goals",
        phase=CyclePhase.GOAL_SETTING.value,
        opens_at=today,
        closes_at=today + timedelta(days=365),
        is_active=True,
    )
    session.add(cycle)
    session.commit()
    print(f"[OK] Created goal cycle: {cycle.name}")
    return cycle

def create_goal_sheets_and_goals(cycle, users):
    """Create goal sheets and goals for employees."""

    # EMP1: Approved with 2 goals
    sheet1 = GoalSheet(
        id=uuid4(),
        employee_id=users["emp1"].id,
        cycle_id=cycle.id,
        status=GoalSheetStatus.APPROVED.value,
        submitted_at=datetime.now(timezone.utc) - timedelta(days=5),
        approved_at=datetime.now(timezone.utc) - timedelta(days=3),
        approved_by=users["manager1"].id,
    )
    session.add(sheet1)
    session.flush()

    goal1_emp1 = Goal(
        id=uuid4(),
        goal_sheet_id=sheet1.id,
        thrust_area="Sales",
        title="Close 50 Enterprise Deals",
        description="Acquire 50 enterprise customers",
        uom_type=UOMType.NUMERIC_MIN.value,
        target_value=50,
        weightage=60.0,
        is_locked=True,
    )
    session.add(goal1_emp1)
    session.flush()

    goal2_emp1 = Goal(
        id=uuid4(),
        goal_sheet_id=sheet1.id,
        thrust_area="Operations",
        title="Reduce Sales Cycle by 20%",
        description="Optimize sales process",
        uom_type=UOMType.NUMERIC_MAX.value,
        target_value=20,
        weightage=40.0,
        is_locked=True,
    )
    session.add(goal2_emp1)
    session.flush()
    print(f"[OK] Created approved sheet for {users['emp1'].name}")

    # EMP2: Submitted (pending approval) with 2 goals
    sheet2 = GoalSheet(
        id=uuid4(),
        employee_id=users["emp2"].id,
        cycle_id=cycle.id,
        status=GoalSheetStatus.SUBMITTED.value,
        submitted_at=datetime.now(timezone.utc) - timedelta(days=2),
        approved_at=None,
        approved_by=None,
    )
    session.add(sheet2)
    session.flush()

    goal1_emp2 = Goal(
        id=uuid4(),
        goal_sheet_id=sheet2.id,
        thrust_area="Sales",
        title="Close 30 SME Deals",
        description="Acquire 30 SME customers",
        uom_type=UOMType.NUMERIC_MIN.value,
        target_value=30,
        weightage=60.0,
        is_locked=False,
    )
    session.add(goal1_emp2)
    session.flush()

    goal2_emp2 = Goal(
        id=uuid4(),
        goal_sheet_id=sheet2.id,
        thrust_area="Customer Success",
        title="Maintain 90% CSAT",
        description="Keep customer satisfaction at 90% or higher",
        uom_type=UOMType.NUMERIC_MIN.value,
        target_value=90,
        weightage=40.0,
        is_locked=False,
    )
    session.add(goal2_emp2)
    session.flush()
    print(f"[OK] Created submitted sheet for {users['emp2'].name}")

    # EMP3: Approved with 2 goals
    sheet3 = GoalSheet(
        id=uuid4(),
        employee_id=users["emp3"].id,
        cycle_id=cycle.id,
        status=GoalSheetStatus.APPROVED.value,
        submitted_at=datetime.now(timezone.utc) - timedelta(days=5),
        approved_at=datetime.now(timezone.utc) - timedelta(days=3),
        approved_by=users["manager2"].id,
    )
    session.add(sheet3)
    session.flush()

    goal1_emp3 = Goal(
        id=uuid4(),
        goal_sheet_id=sheet3.id,
        thrust_area="Marketing",
        title="Generate 200 Qualified Leads",
        description="Generate leads through campaigns",
        uom_type=UOMType.NUMERIC_MIN.value,
        target_value=200,
        weightage=70.0,
        is_locked=True,
    )
    session.add(goal1_emp3)
    session.flush()

    goal2_emp3 = Goal(
        id=uuid4(),
        goal_sheet_id=sheet3.id,
        thrust_area="Brand",
        title="Launch Q2 Campaign",
        description="Execute Q2 brand campaign",
        uom_type=UOMType.TIMELINE.value,
        target_value=1,
        target_date=(datetime.now(timezone.utc) + timedelta(days=90)).date(),
        weightage=30.0,
        is_locked=True,
    )
    session.add(goal2_emp3)
    session.flush()
    print(f"[OK] Created approved sheet for {users['emp3'].name}")

    # EMP4: Submitted (pending approval) with 2 goals
    sheet4 = GoalSheet(
        id=uuid4(),
        employee_id=users["emp4"].id,
        cycle_id=cycle.id,
        status=GoalSheetStatus.SUBMITTED.value,
        submitted_at=datetime.now(timezone.utc) - timedelta(days=1),
        approved_at=None,
        approved_by=None,
    )
    session.add(sheet4)
    session.flush()

    goal1_emp4 = Goal(
        id=uuid4(),
        goal_sheet_id=sheet4.id,
        thrust_area="Marketing",
        title="Run 5 Webinars",
        description="Execute 5 webinars for lead generation",
        uom_type=UOMType.NUMERIC_MIN.value,
        target_value=5,
        weightage=50.0,
        is_locked=False,
    )
    session.add(goal1_emp4)
    session.flush()

    goal2_emp4 = Goal(
        id=uuid4(),
        goal_sheet_id=sheet4.id,
        thrust_area="Content",
        title="Publish 20 Blog Posts",
        description="Publish 20 blog posts for content marketing",
        uom_type=UOMType.NUMERIC_MIN.value,
        target_value=20,
        weightage=50.0,
        is_locked=False,
    )
    session.add(goal2_emp4)
    session.flush()
    print(f"[OK] Created submitted sheet for {users['emp4'].name}")

    session.commit()
    return {
        "sheet1": sheet1,
        "sheet2": sheet2,
        "sheet3": sheet3,
        "sheet4": sheet4,
        "goal1_emp1": goal1_emp1,
        "goal2_emp1": goal2_emp1,
        "goal1_emp3": goal1_emp3,
        "goal2_emp3": goal2_emp3,
    }

def create_achievements(goals_map):
    """Create Q1 achievements for approved goals."""

    # EMP1 Q1 achievements
    ach1 = Achievement(
        id=uuid4(),
        goal_id=goals_map["goal1_emp1"].id,
        goal_sheet_id=goals_map["sheet1"].id,
        actual_value=32,
        status="on_track",
        progress_score=0.64,
        cycle_phase="q1",
    )
    session.add(ach1)

    ach2 = Achievement(
        id=uuid4(),
        goal_id=goals_map["goal2_emp1"].id,
        goal_sheet_id=goals_map["sheet1"].id,
        actual_value=12,
        status="on_track",
        progress_score=0.60,
        cycle_phase="q1",
    )
    session.add(ach2)

    # EMP3 Q1 achievements
    ach3 = Achievement(
        id=uuid4(),
        goal_id=goals_map["goal1_emp3"].id,
        goal_sheet_id=goals_map["sheet3"].id,
        actual_value=145,
        status="on_track",
        progress_score=0.725,
        cycle_phase="q1",
    )
    session.add(ach3)

    ach4 = Achievement(
        id=uuid4(),
        goal_id=goals_map["goal2_emp3"].id,
        goal_sheet_id=goals_map["sheet3"].id,
        actual_value=0,
        status="not_started",
        progress_score=0.0,
        cycle_phase="q1",
    )
    session.add(ach4)

    session.commit()
    print("[OK] Created Q1 achievements for approved sheets")

def main():
    """Run the seed script."""
    print("\n[*] Starting AtomQuest Seed Script...\n")

    try:
        clear_database()
        users = create_users()
        cycle = create_cycle()
        goals_map = create_goal_sheets_and_goals(cycle, users)
        create_achievements(goals_map)

        print("\n" + "="*60)
        print("[OK] ATOMQUEST SEED COMPLETE")
        print("="*60)
        print("Admin:     admin@atomquest.com / Demo@2026")
        print("Manager1:  manager1@atomquest.com / Demo@2026")
        print("Manager2:  manager2@atomquest.com / Demo@2026")
        print("Emp1:      emp1@atomquest.com / Demo@2026 (approved + achievements)")
        print("Emp2:      emp2@atomquest.com / Demo@2026 (pending approval)")
        print("Emp3:      emp3@atomquest.com / Demo@2026 (approved + achievements)")
        print("Emp4:      emp4@atomquest.com / Demo@2026 (pending approval)")
        print("="*60 + "\n")

    except Exception as e:
        print(f"\n[ERR] Error during seeding: {str(e)}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    main()
