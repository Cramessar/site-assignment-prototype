from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field

class CurrentUser(BaseModel):
    email: str
    role: str

class WorkspaceStateResponse(BaseModel):
    revision: int
    payload: dict[str, Any]
    updated_by: str | None = None
    updated_at: datetime | None = None

class WorkspaceStateUpdate(BaseModel):
    expected_revision: int = Field(ge=0)
    payload: dict[str, Any]
    note: str | None = Field(default=None, max_length=500)

class WorkspaceRevisionSummary(BaseModel):
    revision: int
    actor: str
    action: str
    note: str | None = None
    created_at: datetime

class WorkspaceRevisionDetail(WorkspaceRevisionSummary):
    payload: dict[str, Any]
