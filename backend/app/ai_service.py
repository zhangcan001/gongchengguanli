import json
import sqlite3
from typing import Any

import httpx

from .errors import ErrorCode
from .models import AISettingsUpdate
from .repositories import RepositoryError


AI_SETTINGS_KEY = "ai_settings"


class AIUnavailableError(Exception):
    pass


def mask_api_key(api_key: str | None) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "****"
    return f"{api_key[:4]}****{api_key[-4:]}"


class AIService:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def get_settings(self, *, masked: bool = True) -> dict[str, Any]:
        settings = self._load_settings()
        configured = bool(settings.get("base_url") and settings.get("api_key") and settings.get("model"))
        return {
            "base_url": settings.get("base_url", ""),
            "api_key": mask_api_key(settings.get("api_key", "")) if masked else settings.get("api_key", ""),
            "model": settings.get("model", ""),
            "configured": configured,
        }

    def save_settings(self, payload: AISettingsUpdate) -> dict[str, Any]:
        base_url = payload.base_url.strip().rstrip("/")
        api_key = payload.api_key.strip()
        model = payload.model.strip()
        if "****" in api_key:
            api_key = self._load_settings().get("api_key", "")
        if (base_url or api_key or model) and not (base_url and api_key and model):
            raise RepositoryError(ErrorCode.AI_SETTINGS_INVALID, "Base URL, API Key and model must be configured together.")

        value = json.dumps({"base_url": base_url, "api_key": api_key, "model": model}, ensure_ascii=False)
        self.connection.execute(
            """
            INSERT INTO app_setting (key, value, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
            """,
            (AI_SETTINGS_KEY, value),
        )
        self.connection.commit()
        return self.get_settings(masked=True)

    async def generate_json(self, *, prompt: str) -> dict[str, Any]:
        settings = self.get_settings(masked=False)
        if not settings["configured"]:
            raise AIUnavailableError("AI settings are not configured.")

        url = f"{settings['base_url'].rstrip('/')}/chat/completions"
        headers = {"Authorization": f"Bearer {settings['api_key']}", "Content-Type": "application/json"}
        payload = {
            "model": settings["model"],
            "messages": [
                {"role": "system", "content": "你是工程监理日志助手，只输出合法 JSON，不要输出 Markdown。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                body = response.json()
                content = body["choices"][0]["message"]["content"]
                return json.loads(content)
        except Exception as exc:
            raise AIUnavailableError("AI service is unavailable or returned invalid content.") from exc

    def _load_settings(self) -> dict[str, str]:
        row = self.connection.execute("SELECT value FROM app_setting WHERE key = ?", (AI_SETTINGS_KEY,)).fetchone()
        if not row:
            return {"base_url": "", "api_key": "", "model": ""}
        try:
            value = json.loads(row["value"])
        except json.JSONDecodeError:
            return {"base_url": "", "api_key": "", "model": ""}
        return {
            "base_url": str(value.get("base_url") or ""),
            "api_key": str(value.get("api_key") or ""),
            "model": str(value.get("model") or ""),
        }
