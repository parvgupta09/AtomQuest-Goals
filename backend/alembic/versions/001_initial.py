"""Initial migration: create all tables

Revision ID: 001_initial
Revises:
Create Date: 2026-05-17 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='employee'),
        sa.Column('manager_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('department', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['manager_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=False)

    # Create goal_cycles table
    op.create_table(
        'goal_cycles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('phase', sa.String(50), nullable=False),
        sa.Column('opens_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('closes_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create goal_sheets table
    op.create_table(
        'goal_sheets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('cycle_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['cycle_id'], ['goal_cycles.id'], ),
        sa.ForeignKeyConstraint(['employee_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create goals table
    op.create_table(
        'goals',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('goal_sheet_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('thrust_area', sa.String(255), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.String(2000), nullable=True),
        sa.Column('uom_type', sa.String(50), nullable=False),
        sa.Column('target_value', sa.Float(), nullable=False),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column('weightage', sa.Float(), nullable=False),
        sa.Column('is_shared', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('shared_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_locked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['goal_sheet_id'], ['goal_sheets.id'], ),
        sa.ForeignKeyConstraint(['shared_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create achievements table
    op.create_table(
        'achievements',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('goal_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('goal_sheet_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('cycle_phase', sa.String(10), nullable=False),
        sa.Column('actual_value', sa.Float(), nullable=True),
        sa.Column('actual_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='not_started'),
        sa.Column('progress_score', sa.Float(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['goal_id'], ['goals.id'], ),
        sa.ForeignKeyConstraint(['goal_sheet_id'], ['goal_sheets.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create checkin_comments table
    op.create_table(
        'checkin_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('goal_sheet_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('manager_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('phase', sa.String(10), nullable=False),
        sa.Column('comment', sa.String(2000), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['goal_sheet_id'], ['goal_sheets.id'], ),
        sa.ForeignKeyConstraint(['manager_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('goal_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('changed_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('change_type', sa.String(50), nullable=False),
        sa.Column('old_value', postgresql.JSON(), nullable=True),
        sa.Column('new_value', postgresql.JSON(), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['goal_id'], ['goals.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('checkin_comments')
    op.drop_table('achievements')
    op.drop_table('goals')
    op.drop_table('goal_sheets')
    op.drop_table('goal_cycles')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
