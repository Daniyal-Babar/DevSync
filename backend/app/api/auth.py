import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    UserOut,
    TokenResponse,
    RefreshTokenRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Helper to set secure httpOnly cookie for refresh token."""
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.ENVIRONMENT != "development",
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Helper to clear refresh token cookie."""
    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        samesite="lax",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserRegister,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user account."""
    # Check if email or username already taken
    stmt = select(User).where(
        or_(
            User.email == data.email.lower().strip(),
            User.username == data.username.strip(),
        )
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        if existing.email.lower() == data.email.lower().strip():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username is already taken",
            )

    new_user = User(
        email=data.email.lower().strip(),
        username=data.username.strip(),
        password_hash=hash_password(data.password),
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user, return access token and set httpOnly refresh cookie."""
    login_str = data.login.strip().lower()
    stmt = select(User).where(
        or_(
            User.email == login_str,
            User.username == data.login.strip(),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
        )

    access_token = create_access_token(
        user_id=str(user.id),
        extra_claims={"username": user.username, "email": user.email},
    )
    refresh_token = create_refresh_token(user_id=str(user.id))

    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    request: Request,
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Refresh access token using httpOnly refresh cookie or body fallback.
    """
    token = request.cookies.get("refresh_token")
    if not token and body and body.refresh_token:
        token = body.refresh_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    try:
        payload = decode_token(token, expected_type="refresh")
        user_uuid = uuid.UUID(payload["sub"])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid refresh token: {str(exc)}",
        )

    stmt = select(User).where(User.id == user_uuid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Issue new access token and rotate refresh token
    new_access_token = create_access_token(
        user_id=str(user.id),
        extra_claims={"username": user.username, "email": user.email},
    )
    new_refresh_token = create_refresh_token(user_id=str(user.id))
    _set_refresh_cookie(response, new_refresh_token)

    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/logout")
async def logout(response: Response):
    """Clear refresh token cookie and invalidate session on client."""
    _clear_refresh_cookie(response)
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return currently authenticated user."""
    return current_user
