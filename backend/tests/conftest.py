import os
import shutil
import tempfile
import uuid
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password, create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User

# Test database using a local SQLite file in temp directory
TEST_DIR = tempfile.mkdtemp(prefix="devsync_test_")
TEST_DB_PATH = os.path.join(TEST_DIR, "test_devsync.db")
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_PATH}"

# Point settings to temp paths for isolated testing
settings.WORKSPACES_ROOT = os.path.join(TEST_DIR, "workspaces")
os.makedirs(settings.WORKSPACES_ROOT, exist_ok=True)

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    """Create test database tables."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a clean isolated session per test."""
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Async test HTTP client with get_db overridden."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Fixture user for authentication and workspace tests."""
    user = User(
        id=uuid.uuid4(),
        email=f"user_{uuid.uuid4().hex[:6]}@example.com",
        username=f"user_{uuid.uuid4().hex[:6]}",
        password_hash=hash_password("Secret123!"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
def auth_headers(test_user: User) -> dict:
    token = create_access_token(str(test_user.id), extra_claims={"username": test_user.username})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def second_user(db_session: AsyncSession) -> User:
    """A second distinct user for permission boundaries."""
    user = User(
        id=uuid.uuid4(),
        email=f"second_{uuid.uuid4().hex[:6]}@example.com",
        username=f"second_{uuid.uuid4().hex[:6]}",
        password_hash=hash_password("Secret123!"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
def second_user_headers(second_user: User) -> dict:
    token = create_access_token(str(second_user.id), extra_claims={"username": second_user.username})
    return {"Authorization": f"Bearer {token}"}
