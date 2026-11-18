from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import bcrypt
import jwt
from app.core.config import settings


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against the stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """Create a signed JWT token."""
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    to_encode: Dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "exp": expire,
        "iat": now,
    }
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str, extra_claims: Optional[Dict[str, Any]] = None) -> str:
    """Generate access token with configured short lifetime."""
    delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return create_token(
        subject=str(user_id),
        token_type="access",
        expires_delta=delta,
        extra_claims=extra_claims
    )


def create_refresh_token(user_id: str) -> str:
    """Generate refresh token with configured long lifetime."""
    delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return create_token(
        subject=str(user_id),
        token_type="refresh",
        expires_delta=delta
    )


def decode_token(token: str, expected_type: Optional[str] = None) -> Dict[str, Any]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")

    if expected_type and payload.get("type") != expected_type:
        raise ValueError(f"Invalid token type: expected {expected_type}")

    if not payload.get("sub"):
        raise ValueError("Token subject missing")

    return payload
