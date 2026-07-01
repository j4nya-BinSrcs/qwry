from fastapi import FastAPI

from server.src.api.health import router as health_router
from server.src.api.search import router as search_router


def register_routes(app: FastAPI) -> None:
    app.include_router(health_router)
    app.include_router(search_router)
