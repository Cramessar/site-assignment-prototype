from typing import Any

from ..config import get_settings
from .ai_gateway import LocalAIError, list_models


def _model_ids(payload: dict[str, Any]) -> list[str]:
    rows = payload.get("data") or payload.get("models") or []
    ids: list[str] = []
    for row in rows:
        if isinstance(row, str):
            ids.append(row)
        elif isinstance(row, dict):
            value = row.get("id") or row.get("name") or row.get("model")
            if value:
                ids.append(str(value))
    return ids


async def select_assignment_model() -> str:
    settings = get_settings()
    preferred = settings.ai_assignment_model.strip()
    try:
        payload = await list_models()
        ids = _model_ids(payload)
    except LocalAIError:
        ids = []

    candidates = [
        preferred,
        "muse-glimmer:latest",
        "muse-glimmer",
        "reasoning",
        "auto",
        settings.ai_model,
    ]
    for candidate in candidates:
        if not candidate:
            continue
        if candidate in ids:
            return candidate
        if candidate.startswith("muse-glimmer"):
            muse = next((model_id for model_id in ids if model_id.startswith("muse-glimmer")), None)
            if muse:
                return muse

    return preferred or settings.ai_model or "auto"
