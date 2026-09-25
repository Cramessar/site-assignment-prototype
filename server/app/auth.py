from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from .config import get_settings
from .db import get_db
from .models import UserRole
from .schemas import CurrentUser

def _identity_from_request(request: Request) -> str:
    settings = get_settings()
    value = request.headers.get(settings.identity_header)
    if settings.auth_mode.lower() == "dev":
        value = value or settings.dev_user_email
    if not value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authenticated identity is required")
    return value.strip().lower()

def get_current_user(request: Request, db: Session = Depends(get_db)) -> CurrentUser:
    settings = get_settings()
    email = _identity_from_request(request)
    if email in settings.admin_emails:
        role = "admin"
    elif email in settings.supervisor_emails:
        role = "supervisor"
    else:
        stored = db.scalar(select(UserRole).where(UserRole.email == email))
        role = stored.role if stored else "viewer"
    return CurrentUser(email=email, role=role)

def require_supervisor(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role not in {"supervisor", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor access required")
    return user
