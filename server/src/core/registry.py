from dataclasses import dataclass

from server.src.core.config import settings


@dataclass
class Backend:
    base_url: str
    timeout: float


class EndpointRegistry:
    def __init__(self) -> None:
        self.searxng = Backend(
            base_url=settings.searxng_base_url.rstrip("/"),
            timeout=settings.searxng_timeout_seconds,
        )
        self.engine = Backend(
            base_url=settings.engine_base_url.rstrip("/"),
            timeout=settings.engine_timeout_seconds,
        )
