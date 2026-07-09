import uuid

from fastapi import Request

SESSION_HEADER = "X-Session-Id"


def get_session_id(request: Request) -> str:
    sid = request.headers.get(SESSION_HEADER)
    if not sid:
        sid = uuid.uuid4().hex
    return sid
