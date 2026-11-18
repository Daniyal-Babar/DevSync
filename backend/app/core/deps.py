import uuid
from typing import AsyncGenerator, Callable, Optional
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember, WorkspaceRole
from app.services.storage.base import WorkspaceFS
from app.services.storage.local_fs import LocalWorkspaceFS

http_bearer = HTTPBearer(auto_error=False)

ROLE_HIERARCHY = {
    WorkspaceRole.VIEWER: 1,
    WorkspaceRole.EDITOR: 2,
    WorkspaceRole.OWNER: 3,
}


@dataclass
class WorkspaceContext:
    """Convenience context returned by require_workspace_role."""
    workspace: Workspace
    member: WorkspaceMember
    role: WorkspaceRole
    user: User
    fs: WorkspaceFS


def get_workspace_fs(workspace_id: uuid.UUID) -> WorkspaceFS:
    """
    Factory dependency for WorkspaceFS interface.
    Allows easy substitution with a Docker-backed or remote FS in Phase 2.
    """
    return LocalWorkspaceFS(workspace_id=workspace_id)


async def get_current_user(
    request: Request,
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Reusable FastAPI dependency to authenticate the request via Bearer token
    or fallback to access_token cookie.
    """
    token: Optional[str] = None

    if auth_header and auth_header.credentials:
        token = auth_header.credentials
    elif "access_token" in request.cookies:
        token = request.cookies["access_token"]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(token, expected_type="access")
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_uuid = uuid.UUID(user_id_str)
    except (ValueError, Exception) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc) if str(exc) else "Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(User).where(User.id == user_uuid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_workspace_role(min_role: WorkspaceRole) -> Callable:
    """
    Reusable workspace role authorization dependency.
    Validates that:
    1. The workspace exists
    2. The current user is an active member of the workspace
    3. The member's role meets or exceeds min_role
    """
    async def _workspace_role_dependency(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> WorkspaceContext:
        # Extract workspace id from path parameters
        # FastAPI passes path params to request.path_params
        workspace_id_raw = request.path_params.get("id") or request.path_params.get("workspace_id")
        if not workspace_id_raw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workspace ID missing from request path",
            )

        try:
            workspace_uuid = uuid.UUID(str(workspace_id_raw))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid workspace ID format",
            )

        # Retrieve workspace
        ws_stmt = select(Workspace).where(Workspace.id == workspace_uuid)
        ws_result = await db.execute(ws_stmt)
        workspace = ws_result.scalar_one_or_none()
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found",
            )

        # Retrieve membership
        mem_stmt = select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_uuid,
            WorkspaceMember.user_id == current_user.id,
        )
        mem_result = await db.execute(mem_stmt)
        member = mem_result.scalar_one_or_none()

        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this workspace",
            )

        user_level = ROLE_HIERARCHY.get(member.role, 0)
        required_level = ROLE_HIERARCHY.get(min_role, 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires '{min_role.value}' permission, but you have '{member.role.value}'",
            )

        fs = get_workspace_fs(workspace_uuid)

        return WorkspaceContext(
            workspace=workspace,
            member=member,
            role=member.role,
            user=current_user,
            fs=fs,
        )

    return _workspace_role_dependency
