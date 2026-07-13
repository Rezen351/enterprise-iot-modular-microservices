"""JWT authentication dependency.

Mirrors the claims issued by the Auth Service (``uid``, ``username``,
``roles``) and the validation performed by the Go services. When the shared
JWT secret is empty (dev), auth is skipped and requests pass through, just
like the Go middleware.
"""
from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

settings = get_settings()
security = HTTPBearer(auto_error=False)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc


def _auth_disabled() -> bool:
    """Auth may only be skipped when no secret is set AND we are explicitly in a
    development environment. In any other case an empty secret fails closed so a
    production misconfiguration never silently grants access."""
    if settings.jwt_secret:
        return False
    if settings.environment.lower() in ("development", "dev", "local", "test"):
        return True
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Authentication is not configured (JWT secret missing)",
    )


def get_claims(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """Return the JWT claims dict. Pass-through only when auth is disabled (dev)."""
    if _auth_disabled():
        return {"uid": "dev", "username": "dev", "roles": settings.write_roles}

    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    claims = _decode(creds.credentials)
    claims.setdefault("roles", [])
    return claims


def require_roles(allowed: list[str]):
    def dependency(claims: dict = Depends(get_claims)) -> dict:
        if _auth_disabled():
            return claims
        roles = set(claims.get("roles", []))
        if roles & set(allowed):
            return claims
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires one of roles: {allowed}",
        )

    return dependency


# Convenience dependencies
require_write = require_roles(settings.write_roles)
require_read = require_roles(settings.read_roles)
