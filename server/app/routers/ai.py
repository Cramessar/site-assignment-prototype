from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import require_supervisor
from ..schemas import CurrentUser
from ..services.ai_gateway import LocalAIError, assist, list_models

router = APIRouter(prefix="/api/v1/ai", tags=["local-ai"])

class AssistRequest(BaseModel):
    task: str = Field(min_length=3, max_length=4000)
    context: dict[str, Any] = Field(default_factory=dict)
    model: str | None = Field(default=None, max_length=200)

class AssistResponse(BaseModel):
    model: str
    content: str

@router.get("/models")
async def models(_: CurrentUser = Depends(require_supervisor)) -> dict[str, Any]:
    try:
        return await list_models()
    except LocalAIError as exc:
        raise HTTPException(status_code=502, detail=f"Local AI gateway unavailable: {exc}") from exc

@router.post("/assist", response_model=AssistResponse)
async def ai_assist(body: AssistRequest, _: CurrentUser = Depends(require_supervisor)) -> AssistResponse:
    try:
        result = await assist(task=body.task, context=body.context, model=body.model)
        return AssistResponse(model=result["model"], content=result["content"])
    except LocalAIError as exc:
        raise HTTPException(status_code=502, detail=f"Local AI gateway unavailable: {exc}") from exc
