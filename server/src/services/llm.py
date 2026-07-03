from abc import ABC, abstractmethod

import httpx


class LLMBackend(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system_prompt: str | None = None) -> str: ...


class OllamaBackend(LLMBackend):
    def __init__(self, http_client: httpx.AsyncClient, base_url: str, model: str, timeout: float = 30.0) -> None:
        self._client = http_client
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout

    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        payload: dict = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
        }
        if system_prompt:
            payload["system"] = system_prompt

        resp = await self._client.post(
            f"{self._base_url}/api/generate",
            json=payload,
            timeout=self._timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            msg = data["error"] or "unknown Ollama error"
            raise RuntimeError(msg)
        return data.get("response", "")
