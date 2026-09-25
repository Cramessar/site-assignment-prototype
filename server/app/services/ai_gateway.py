import json
from typing import Any

import httpx

from ..config import get_settings

SYSTEM_PROMPT = """You are the advisory assistant for an internal technical-support site coverage system.
The deterministic application rules are the source of truth for assignments, staffing, vacations,
availability, locked site ownership, workload scores, and handoff times.

Your job is to help supervisors:
- review proposed coverage plans for workload imbalance or confusing handoffs,
- explain why a plan looks balanced or unbalanced,
- summarize changes in plain language,
- draft concise team-facing coverage reports,
- identify questions a supervisor should verify.

Do not claim to publish, save, or change assignments. Do not invent missing staffing, site, workload,
or availability data. Clearly distinguish observations from recommendations.
"""

class LocalAIError(RuntimeError):
    pass

def _headers() -> dict[str, str]:
    settings = get_settings()
    headers = {"Content-Type": "application/json"}
    if settings.ai_api_key:
        headers["Authorization"] = f"Bearer {settings.ai_api_key}"
    return headers

async def list_models() -> dict[str, Any]:
    settings = get_settings()
    if not settings.ai_enabled:
        return {"enabled": False, "data": []}
    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            response = await client.get(f"{settings.ai_base_url.rstrip('/')}/models", headers=_headers())
            response.raise_for_status()
            payload = response.json()
            return {"enabled": True, **payload}
    except (httpx.HTTPError, ValueError) as exc:
        raise LocalAIError(str(exc)) from exc

async def assist(*, task: str, context: dict[str, Any] | None = None, model: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    if not settings.ai_enabled:
        raise LocalAIError("Local AI integration is disabled")

    raw_context = json.dumps(context or {}, ensure_ascii=False, default=str)
    if len(raw_context) > settings.ai_max_context_chars:
        raw_context = raw_context[:settings.ai_max_context_chars] + "\n[context truncated]"

    chosen_model = model or settings.ai_model
    body = {
        "model": chosen_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Task:\n{task.strip()}\n\nApplication context:\n{raw_context}",
            },
        ],
        "temperature": 0.2,
    }

    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            response = await client.post(
                f"{settings.ai_base_url.rstrip('/')}/chat/completions",
                headers=_headers(),
                json=body,
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise LocalAIError(str(exc)) from exc

    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise LocalAIError("AI gateway returned an unexpected response shape") from exc

    return {"model": chosen_model, "content": content, "raw": payload}
