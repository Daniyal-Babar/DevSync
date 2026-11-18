from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import require_workspace_role, WorkspaceContext
from app.models.workspace_member import WorkspaceRole
from app.schemas.files import (
    FileNode,
    FileTreeResponse,
    FileContentResponse,
    FileSaveRequest,
    FileCreateRequest,
    FileRenameRequest,
)
from app.services.storage.base import (
    StorageError,
    PathTraversalError,
    FileNotFoundStorageError,
    FileExistsStorageError,
    FileTooLargeStorageError,
    BinaryFileNotSupportedError,
)

router = APIRouter(prefix="/workspaces/{id}/files", tags=["files"])


def _handle_storage_exception(exc: Exception) -> HTTPException:
    """Map internal storage errors to standard HTTP exceptions."""
    if isinstance(exc, PathTraversalError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security violation: {str(exc)}",
        )
    elif isinstance(exc, FileNotFoundStorageError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    elif isinstance(exc, FileExistsStorageError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    elif isinstance(exc, FileTooLargeStorageError):
        return HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=str(exc),
        )
    elif isinstance(exc, BinaryFileNotSupportedError):
        return HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        )
    elif isinstance(exc, StorageError):
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage operation failed: {str(exc)}",
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unexpected filesystem error",
    )


@router.get("/tree", response_model=FileTreeResponse)
async def get_tree(
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.VIEWER)),
):
    """Retrieve full workspace folder tree (viewers and above)."""
    try:
        nodes = await ctx.fs.list_tree()
        return FileTreeResponse(root=nodes)
    except Exception as exc:
        raise _handle_storage_exception(exc)


@router.get("/content", response_model=FileContentResponse)
async def get_file_content(
    path: str = Query(..., description="Workspace-relative path to the file"),
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.VIEWER)),
):
    """Read file content as text (viewers and above; rejects files > 2MB and binary)."""
    try:
        content = await ctx.fs.read_file(path)
        return FileContentResponse(
            path=path,
            content=content,
            size=len(content.encode("utf-8")),
        )
    except Exception as exc:
        raise _handle_storage_exception(exc)


@router.put("/content", response_model=FileContentResponse)
async def save_file_content(
    data: FileSaveRequest,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.EDITOR)),
):
    """Save content to file (requires editor or owner role)."""
    try:
        bytes_written = await ctx.fs.write_file(data.path, data.content)
        return FileContentResponse(
            path=data.path,
            content=data.content,
            size=bytes_written,
        )
    except Exception as exc:
        raise _handle_storage_exception(exc)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_file_or_dir(
    data: FileCreateRequest,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.EDITOR)),
):
    """Create a new file or directory (requires editor or owner role)."""
    try:
        if data.type == "file":
            await ctx.fs.create_file(data.path)
            return {"message": f"File '{data.path}' created successfully", "path": data.path, "type": "file"}
        else:
            await ctx.fs.create_dir(data.path)
            return {"message": f"Directory '{data.path}' created successfully", "path": data.path, "type": "dir"}
    except Exception as exc:
        raise _handle_storage_exception(exc)


@router.patch("")
async def rename_or_move(
    data: FileRenameRequest,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.EDITOR)),
):
    """Rename or move a file/directory (requires editor or owner role)."""
    try:
        await ctx.fs.rename(data.path, data.new_path)
        return {
            "message": f"Successfully renamed '{data.path}' to '{data.new_path}'",
            "path": data.new_path,
        }
    except Exception as exc:
        raise _handle_storage_exception(exc)


@router.delete("")
async def delete_file_or_dir(
    path: str = Query(..., description="Workspace-relative path to delete"),
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.EDITOR)),
):
    """Delete a file or directory recursively (requires editor or owner role)."""
    try:
        await ctx.fs.delete(path)
        return {"message": f"Successfully deleted '{path}'"}
    except Exception as exc:
        raise _handle_storage_exception(exc)
