from datetime import datetime, timezone
import os
from typing import Any, Dict, List

from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from .auth import (
    authenticate_user,
    create_access_token,
    create_user,
    ensure_user_indexes,
    get_current_user,
    require_admin,
    serialize_user,
)
from .database import close_mongo_connection, connect_to_mongo, get_database
from .models import (
    AuthResponse,
    DashboardOut,
    DashboardSummary,
    ProjectCreate,
    ProjectMembersUpdate,
    ProjectOut,
    TaskCreate,
    TaskOut,
    TaskStatus,
    TaskStatusUpdate,
    UserLogin,
    UserPublic,
    UserRole,
    UserSignup,
)

APP_TITLE = os.getenv("APP_TITLE", "Team Task Manager API")


def parse_cors_origins(raw: str) -> List[str]:
    raw = raw.strip()
    if raw == "*":
        return ["*"]
    origins: List[str] = []
    for origin in raw.split(","):
        normalized = origin.strip().rstrip("/")
        if normalized:
            origins.append(normalized)
    return origins or ["*"]


def parse_bool_env(value: str, default: bool = False) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


CORS_ORIGINS = parse_cors_origins(os.getenv("CORS_ORIGINS", "*"))
CORS_ALLOW_CREDENTIALS = parse_bool_env(os.getenv("CORS_ALLOW_CREDENTIALS", "false"))
CORS_ALLOW_ORIGIN_REGEX = os.getenv("CORS_ALLOW_ORIGIN_REGEX", "").strip() or None

# Browsers reject credentialed CORS responses when allow-origin is "*".
if "*" in CORS_ORIGINS and CORS_ALLOW_CREDENTIALS:
    CORS_ALLOW_CREDENTIALS = False

app = FastAPI(title=APP_TITLE)


@app.middleware("http")
async def normalize_api_prefix(request: Request, call_next):
    path = request.scope.get("path", "")
    if path == "/api":
        request.scope["path"] = "/"
    elif path.startswith("/api/"):
        request.scope["path"] = path[4:] or "/"
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ALLOW_ORIGIN_REGEX,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def to_utc_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def require_utc_datetime(value: datetime | None, field_name: str) -> datetime:
    normalized = to_utc_aware(value)
    if normalized is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Task data is missing required field: {field_name}.",
        )
    return normalized


def parse_object_id(value: str, field_name: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name}.",
        ) from exc


def serialize_project(project_doc: Dict[str, Any]) -> ProjectOut:
    return ProjectOut(
        id=str(project_doc["_id"]),
        name=project_doc["name"],
        description=project_doc.get("description", ""),
        created_by=str(project_doc["created_by"]),
        member_ids=[str(member_id) for member_id in project_doc.get("member_ids", [])],
        created_at=project_doc["created_at"],
    )


def serialize_task(task_doc: Dict[str, Any]) -> TaskOut:
    now = datetime.now(timezone.utc)
    due_date = to_utc_aware(task_doc.get("due_date"))
    started_at = to_utc_aware(task_doc.get("started_at"))
    completed_at = to_utc_aware(task_doc.get("completed_at"))
    created_at = require_utc_datetime(task_doc.get("created_at"), "created_at")
    updated_at = require_utc_datetime(task_doc.get("updated_at"), "updated_at")
    is_overdue = bool(
        due_date and due_date < now and task_doc.get("status") != TaskStatus.done.value
    )
    return TaskOut(
        id=str(task_doc["_id"]),
        project_id=str(task_doc["project_id"]),
        title=task_doc["title"],
        description=task_doc.get("description", ""),
        status=TaskStatus(task_doc["status"]),
        assignee_id=str(task_doc["assignee_id"]) if task_doc.get("assignee_id") else None,
        due_date=due_date,
        created_by=str(task_doc["created_by"]),
        created_at=created_at,
        updated_at=updated_at,
        is_overdue=is_overdue,
        started_at=started_at,
        completed_at=completed_at,
        time_spent_seconds=task_doc.get("time_spent_seconds", 0),
    )


async def ensure_task_indexes(db: AsyncIOMotorDatabase) -> None:
    await db["projects"].create_index("member_ids")
    await db["tasks"].create_index("project_id")
    await db["tasks"].create_index("assignee_id")
    await db["tasks"].create_index("due_date")


async def assert_project_access(
    db: AsyncIOMotorDatabase,
    project_id: str,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    object_id = parse_object_id(project_id, "project_id")
    project = await db["projects"].find_one({"_id": object_id})
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    if current_user["role"] == UserRole.admin.value:
        return project

    if current_user["_id"] not in project.get("member_ids", []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project access denied.")

    return project


@app.on_event("startup")
async def startup_event() -> None:
    await connect_to_mongo()
    db = await get_database()
    await ensure_user_indexes(db)
    await ensure_task_indexes(db)


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await close_mongo_connection()


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: UserSignup, db: AsyncIOMotorDatabase = Depends(get_database)) -> AuthResponse:
    requested_role = payload.role

    if requested_role == UserRole.admin:
        configured_invite_code = os.getenv("ADMIN_SIGNUP_CODE", "").strip()
        provided_invite_code = (payload.admin_invite_code or "").strip()

        if not configured_invite_code or provided_invite_code != configured_invite_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin signup is restricted.",
            )

    user = await create_user(
        db,
        name=payload.name,
        email=payload.email,
        password=payload.password,
        role=requested_role,
    )
    user_public = serialize_user(user)
    access_token = create_access_token(user_id=user_public.id, role=user_public.role)
    return AuthResponse(access_token=access_token, user=user_public)


@app.post("/auth/login", response_model=AuthResponse)
async def login(payload: UserLogin, db: AsyncIOMotorDatabase = Depends(get_database)) -> AuthResponse:
    user = await authenticate_user(db, payload.email, payload.password)
    user_public = serialize_user(user)
    access_token = create_access_token(user_id=user_public.id, role=user_public.role)
    return AuthResponse(access_token=access_token, user=user_public)


@app.get("/auth/me", response_model=UserPublic)
async def me(current_user: Dict[str, Any] = Depends(get_current_user)) -> UserPublic:
    return serialize_user(current_user)


@app.get("/auth/users", response_model=List[UserPublic])
async def list_users(
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: Dict[str, Any] = Depends(require_admin),
) -> List[UserPublic]:
    users = await db["users"].find({}, {"password_hash": 0}).to_list(length=200)
    return [serialize_user(user) for user in users]


@app.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    admin_user: Dict[str, Any] = Depends(require_admin),
) -> ProjectOut:
    member_object_ids = [parse_object_id(member_id, "member_ids") for member_id in payload.member_ids]
    if member_object_ids:
        member_count = await db["users"].count_documents({"_id": {"$in": member_object_ids}})
        if member_count != len(set(member_object_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more member_ids are invalid.",
            )

    if admin_user["_id"] not in member_object_ids:
        member_object_ids.append(admin_user["_id"])

    project_doc = {
        "name": payload.name.strip(),
        "description": payload.description.strip(),
        "created_by": admin_user["_id"],
        "member_ids": member_object_ids,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db["projects"].insert_one(project_doc)
    project_doc["_id"] = result.inserted_id
    return serialize_project(project_doc)


@app.get("/projects", response_model=List[ProjectOut])
async def list_projects(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[ProjectOut]:
    query = {} if current_user["role"] == UserRole.admin.value else {"member_ids": current_user["_id"]}
    projects = await db["projects"].find(query).sort("created_at", -1).to_list(length=200)
    return [serialize_project(project) for project in projects]


@app.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ProjectOut:
    project = await assert_project_access(db, project_id, current_user)
    return serialize_project(project)


@app.post("/projects/{project_id}/members", response_model=ProjectOut)
async def add_project_members(
    project_id: str,
    payload: ProjectMembersUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: Dict[str, Any] = Depends(require_admin),
) -> ProjectOut:
    project_object_id = parse_object_id(project_id, "project_id")
    member_object_ids = [parse_object_id(member_id, "member_ids") for member_id in payload.member_ids]
    users_count = await db["users"].count_documents({"_id": {"$in": member_object_ids}})
    if users_count != len(set(member_object_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more member_ids are invalid.",
        )

    result = await db["projects"].find_one_and_update(
        {"_id": project_object_id},
        {"$addToSet": {"member_ids": {"$each": member_object_ids}}},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    return serialize_project(result)


@app.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    admin_user: Dict[str, Any] = Depends(require_admin),
) -> TaskOut:
    project_id = parse_object_id(payload.project_id, "project_id")
    project = await db["projects"].find_one({"_id": project_id})
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    assignee_object_id = None
    if payload.assignee_id:
        assignee_object_id = parse_object_id(payload.assignee_id, "assignee_id")
        if assignee_object_id not in project.get("member_ids", []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be part of the project team.",
            )

    now = datetime.now(timezone.utc)
    task_doc = {
        "project_id": project_id,
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "status": payload.status.value,
        "assignee_id": assignee_object_id,
        "due_date": to_utc_aware(payload.due_date),
        "created_by": admin_user["_id"],
        "created_at": now,
        "updated_at": now,
    }
    result = await db["tasks"].insert_one(task_doc)
    task_doc["_id"] = result.inserted_id
    return serialize_task(task_doc)


@app.get("/tasks/me", response_model=List[TaskOut])
async def list_my_tasks(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[TaskOut]:
    if current_user["role"] == UserRole.admin.value:
        tasks = await db["tasks"].find({}).sort("updated_at", -1).to_list(length=500)
    else:
        tasks = await db["tasks"].find({"assignee_id": current_user["_id"]}).sort("updated_at", -1).to_list(length=500)

    return [serialize_task(task) for task in tasks]


@app.get("/tasks/project/{project_id}", response_model=List[TaskOut])
async def list_project_tasks(
    project_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[TaskOut]:
    await assert_project_access(db, project_id, current_user)
    project_object_id = parse_object_id(project_id, "project_id")
    tasks = await db["tasks"].find({"project_id": project_object_id}).sort("created_at", -1).to_list(length=500)
    return [serialize_task(task) for task in tasks]


@app.patch("/tasks/{task_id}/status", response_model=TaskOut)
async def update_task_status(
    task_id: str,
    payload: TaskStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> TaskOut:
    task_object_id = parse_object_id(task_id, "task_id")
    task = await db["tasks"].find_one({"_id": task_object_id})
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    if current_user["role"] != UserRole.admin.value and task.get("assignee_id") != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update tasks assigned to you.",
        )

    updated = await db["tasks"].find_one_and_update(
        {"_id": task_object_id},
        {"$set": {"status": payload.status.value, "updated_at": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    return serialize_task(updated)


@app.post("/tasks/{task_id}/start")
async def start_task(
    task_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> TaskOut:
    task_oid = parse_object_id(task_id, "task_id")
    task = await db["tasks"].find_one({"_id": task_oid})
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    if task.get("assignee_id") and str(task["assignee_id"]) != str(current_user["_id"]) and current_user["role"] != UserRole.admin.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to start this task.")

    now = datetime.now(timezone.utc)
    updated = await db["tasks"].find_one_and_update(
        {"_id": task_oid},
        {
            "$set": {
                "started_at": now,
                "status": TaskStatus.in_progress.value,
                "updated_at": now,
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    return serialize_task(updated)


@app.post("/tasks/{task_id}/stop")
async def stop_task(
    task_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> TaskOut:
    task_oid = parse_object_id(task_id, "task_id")
    task = await db["tasks"].find_one({"_id": task_oid})
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    if task.get("assignee_id") and str(task["assignee_id"]) != str(current_user["_id"]) and current_user["role"] != UserRole.admin.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to stop this task.")

    now = datetime.now(timezone.utc)
    time_spent = 0
    started_at = to_utc_aware(task.get("started_at"))
    if started_at:
        time_spent = int((now - started_at).total_seconds())

    updated = await db["tasks"].find_one_and_update(
        {"_id": task_oid},
        {
            "$set": {
                "completed_at": now,
                "time_spent_seconds": time_spent,
                "status": TaskStatus.done.value,
                "updated_at": now,
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    return serialize_task(updated)


@app.get("/tasks/dashboard", response_model=DashboardOut)
async def dashboard(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> DashboardOut:
    query = {} if current_user["role"] == UserRole.admin.value else {"assignee_id": current_user["_id"]}
    tasks = await db["tasks"].find(query).to_list(length=1000)
    serialized_tasks = [serialize_task(task) for task in tasks]

    summary = DashboardSummary(
        total=len(serialized_tasks),
        todo=sum(1 for task in serialized_tasks if task.status == TaskStatus.todo),
        in_progress=sum(1 for task in serialized_tasks if task.status == TaskStatus.in_progress),
        done=sum(1 for task in serialized_tasks if task.status == TaskStatus.done),
        overdue=sum(1 for task in serialized_tasks if task.is_overdue),
    )
    overdue_tasks = [task for task in serialized_tasks if task.is_overdue][:10]
    return DashboardOut(summary=summary, overdue_tasks=overdue_tasks)
