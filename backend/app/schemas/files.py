from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class FileNode(BaseModel):
    name: str
    path: str  # workspace-relative path with forward slashes, e.g. "src/index.js"
    type: Literal["file", "dir"]
    size: Optional[int] = None
    children: Optional[List["FileNode"]] = None


class FileTreeResponse(BaseModel):
    root: List[FileNode]


class FileContentResponse(BaseModel):
    path: str
    content: str
    size: int


class FileSaveRequest(BaseModel):
    path: str = Field(..., min_length=1)
    content: str


class FileCreateRequest(BaseModel):
    path: str = Field(..., min_length=1)
    type: Literal["file", "dir"]


class FileRenameRequest(BaseModel):
    path: str = Field(..., min_length=1)
    new_path: str = Field(..., min_length=1)
