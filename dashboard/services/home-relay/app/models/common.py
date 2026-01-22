"""Common Pydantic models shared across endpoints."""

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Standard error response."""

    error: str


class SuccessResponse(BaseModel):
    """Standard success response."""

    success: bool


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
