import shutil
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import (
    get_current_user,
    require_workspace_role,
    get_workspace_fs,
    WorkspaceContext,
)
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember, WorkspaceRole
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceWithRoleOut,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceWithRoleOut, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new workspace, register the creator as OWNER in workspace_members,
    and initialize files from the selected starter template.
    """
    workspace = Workspace(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        owner_id=current_user.id,
    )
    db.add(workspace)
    await db.flush()  # assign workspace.id

    # Create owner membership row
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=current_user.id,
        role=WorkspaceRole.OWNER,
    )
    db.add(member)
    await db.commit()
    await db.refresh(workspace)

    # Initialize filesystem template
    fs = get_workspace_fs(workspace.id)
    await fs.initialize_template(data.template.value)

    return WorkspaceWithRoleOut(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        owner_id=workspace.owner_id,
        role=WorkspaceRole.OWNER,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
    )


@router.get("", response_model=List[WorkspaceWithRoleOut])
async def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all workspaces where the current user is a member (owner, editor, or viewer).
    """
    stmt = (
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == current_user.id)
        .order_by(Workspace.updated_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    workspaces: List[WorkspaceWithRoleOut] = []
    for ws, role in rows:
        workspaces.append(
            WorkspaceWithRoleOut(
                id=ws.id,
                name=ws.name,
                description=ws.description,
                owner_id=ws.owner_id,
                role=role,
                created_at=ws.created_at,
                updated_at=ws.updated_at,
            )
        )
    return workspaces


@router.get("/{id}", response_model=WorkspaceWithRoleOut)
async def get_workspace(
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.VIEWER)),
):
    """Get single workspace details (requires viewer or higher)."""
    return WorkspaceWithRoleOut(
        id=ctx.workspace.id,
        name=ctx.workspace.name,
        description=ctx.workspace.description,
        owner_id=ctx.workspace.owner_id,
        role=ctx.role,
        created_at=ctx.workspace.created_at,
        updated_at=ctx.workspace.updated_at,
    )


@router.patch("/{id}", response_model=WorkspaceWithRoleOut)
async def update_workspace(
    data: WorkspaceUpdate,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.OWNER)),
    db: AsyncSession = Depends(get_db),
):
    """Update workspace name or description (requires owner role)."""
    if data.name is not None:
        ctx.workspace.name = data.name.strip()
    if data.description is not None:
        ctx.workspace.description = data.description.strip()

    await db.commit()
    await db.refresh(ctx.workspace)

    return WorkspaceWithRoleOut(
        id=ctx.workspace.id,
        name=ctx.workspace.name,
        description=ctx.workspace.description,
        owner_id=ctx.workspace.owner_id,
        role=ctx.role,
        created_at=ctx.workspace.created_at,
        updated_at=ctx.workspace.updated_at,
    )


@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_workspace(
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.OWNER)),
    db: AsyncSession = Depends(get_db),
):
    """Delete workspace and all associated files (requires owner role)."""
    # Delete workspace directory from disk
    try:
        shutil.rmtree(ctx.fs.root_dir, ignore_errors=True)
    except Exception:
        pass

    # Delete workspace from database (cascades to members)
    await db.delete(ctx.workspace)
    await db.commit()

    return {"message": "Workspace deleted successfully", "id": str(ctx.workspace.id)}
