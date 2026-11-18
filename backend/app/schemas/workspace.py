import enum
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from app.models.workspace_member import WorkspaceRole


class WorkspaceTemplate(str, enum.Enum):
    EMPTY = "empty"
    STARTER_WEB = "starter_web"
    STARTER_PYTHON = "starter_python"


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    template: WorkspaceTemplate = WorkspaceTemplate.EMPTY


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class WorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str]
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class WorkspaceWithRoleOut(WorkspaceOut):
    role: WorkspaceRole
