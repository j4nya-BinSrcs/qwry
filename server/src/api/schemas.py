from pydantic import BaseModel, HttpUrl


class SearchRequest(BaseModel):
    q: str
    page: int = 1
    page_size: int = 10
    provider: str | None = None


class SearchResultItem(BaseModel):
    title: str
    url: str
    snippet: str
    source: str


class SearchResponse(BaseModel):
    query: str
    page: int
    page_size: int
    total_results: int
    results: list[SearchResultItem]
    provider: str


class ErrorResponse(BaseModel):
    detail: str
    error_code: str | None = None
