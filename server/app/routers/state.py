from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from ..auth import get_current_user, require_supervisor
from ..db import get_db
from ..models import WorkspaceRevision, WorkspaceState
from ..schemas import CurrentUser, WorkspaceRevisionDetail, WorkspaceRevisionSummary, WorkspaceStateResponse, WorkspaceStateUpdate

router = APIRouter(prefix="/api/v1", tags=["workspace"])

@router.get("/me", response_model=CurrentUser)
def me(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return user

@router.get("/state", response_model=WorkspaceStateResponse)
def get_state(db: Session = Depends(get_db), _: CurrentUser = Depends(get_current_user)) -> WorkspaceStateResponse:
    row = db.get(WorkspaceState, 1)
    if not row:
        return WorkspaceStateResponse(revision=0, payload={})
    return WorkspaceStateResponse(revision=row.revision, payload=row.payload, updated_by=row.updated_by, updated_at=row.updated_at)

@router.put("/state", response_model=WorkspaceStateResponse)
def update_state(body: WorkspaceStateUpdate, db: Session = Depends(get_db), user: CurrentUser = Depends(require_supervisor)) -> WorkspaceStateResponse:
    with db.begin():
        row = db.scalar(select(WorkspaceState).where(WorkspaceState.id == 1).with_for_update())
        current_revision = row.revision if row else 0
        if body.expected_revision != current_revision:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message":"State changed since you loaded it","expected_revision":body.expected_revision,"current_revision":current_revision})
        new_revision = current_revision + 1
        if row is None:
            row = WorkspaceState(id=1, revision=new_revision, payload=body.payload, updated_by=user.email)
            db.add(row)
        else:
            row.revision = new_revision
            row.payload = body.payload
            row.updated_by = user.email
        db.add(WorkspaceRevision(revision=new_revision, actor=user.email, action="state.update", note=body.note, payload=body.payload))
    db.refresh(row)
    return WorkspaceStateResponse(revision=row.revision, payload=row.payload, updated_by=row.updated_by, updated_at=row.updated_at)

@router.get("/state/history", response_model=list[WorkspaceRevisionSummary])
def state_history(limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db), _: CurrentUser = Depends(get_current_user)) -> list[WorkspaceRevisionSummary]:
    rows = db.scalars(select(WorkspaceRevision).order_by(desc(WorkspaceRevision.revision)).limit(limit)).all()
    return [WorkspaceRevisionSummary(revision=row.revision, actor=row.actor, action=row.action, note=row.note, created_at=row.created_at) for row in rows]

@router.get("/state/revisions/{revision}", response_model=WorkspaceRevisionDetail)
def state_revision(revision: int, db: Session = Depends(get_db), _: CurrentUser = Depends(get_current_user)) -> WorkspaceRevisionDetail:
    row = db.get(WorkspaceRevision, revision)
    if not row:
        raise HTTPException(status_code=404, detail="Revision not found")
    return WorkspaceRevisionDetail(revision=row.revision, actor=row.actor, action=row.action, note=row.note, created_at=row.created_at, payload=row.payload)
