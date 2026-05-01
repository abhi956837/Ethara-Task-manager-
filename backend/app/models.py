from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    admin = "admin"
    member = "member"


class TaskStatus(str, Enum):
    todo = "To Do"
    in_progress = "In Progress"
    done = "Done"


class MessageResponse(BaseModel):
    message: str


class UserSignup(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.member
    admin_invite_code: Optional[str] = Field(default=None, max_length=256)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: UserRole
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    member_ids: List[str] = Field(default_factory=list)


class ProjectMembersUpdate(BaseModel):
    member_ids: List[str] = Field(min_length=1)


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str
    created_by: str
    member_ids: List[str]
    created_at: datetime


class TaskCreate(BaseModel):
    project_id: str
    title: str = Field(min_length=2, max_length=140)
    description: str = Field(default="", max_length=1000)
    status: TaskStatus = TaskStatus.todo
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: str
    status: TaskStatus
    assignee_id: Optional[str]
    due_date: Optional[datetime]
    created_by: str
    created_at: datetime
    updated_at: datetime
    is_overdue: bool
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    time_spent_seconds: int = 0


class DashboardSummary(BaseModel):
    total: int
    todo: int
    in_progress: int
    done: int
    overdue: int


class DashboardOut(BaseModel):
    summary: DashboardSummary
    overdue_tasks: List[TaskOut]
