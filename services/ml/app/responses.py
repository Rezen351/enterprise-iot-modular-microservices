"""Standardized API response envelope (AGENTS.md §4.4).

Every successful JSON response is wrapped as ``{"success": true, "data": ...}``
and every error as ``{"success": false, "error": {"code": "<CODE>", "message": "..."}}``
so the ML service matches the rest of the platform (Go services).
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

# Map HTTP status codes to the standardized upper-case error codes used across
# the platform (mirrors the Go services' ErrorCode constants).
_ERROR_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "BAD_REQUEST",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_ERROR",
    503: "SERVICE_UNAVAILABLE",
}


class EnvelopeJSONResponse(JSONResponse):
    """Wrap the serialized success body in ``{"success": true, "data": ...}``."""

    def render(self, content):
        return super().render({"success": True, "data": content})


def error_response(status_code: int, message: str) -> JSONResponse:
    code = _ERROR_CODES.get(
        status_code,
        "INTERNAL_ERROR" if status_code >= 500 else "BAD_REQUEST",
    )
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message}},
    )


def install_response_wrapper(app: FastAPI) -> None:
    """Register envelope rendering + centralized error handlers on the app."""

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception_handler(request, exc):
        return error_response(exc.status_code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validation_exception_handler(request, exc):
        return error_response(422, "Invalid request parameters")

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(request, exc):
        logger.exception("Unhandled error: %s", exc)
        return error_response(500, "Internal server error")
