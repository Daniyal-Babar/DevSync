import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.base import Base
from app.db.session import async_engine
from app.api.auth import router as auth_router
from app.api.workspaces import router as workspaces_router
from app.api.files import router as files_router

# Configure logging
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("devsync")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("DevSync Backend starting up...")
    # Initialize tables if necessary (e.g. SQLite for tests or quick dev)
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema validated/initialized.")
    yield
    logger.info("DevSync Backend shutting down...")
    await async_engine.dispose()


app = FastAPI(
    title="DevSync API",
    description="Browser-based collaborative cloud development environment API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Consistent error response formatting
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err["loc"] if loc != "body")
        errors.append({"field": field, "message": err["msg"]})
    logger.warning("Validation error on %s %s: %s", request.method, request.url.path, errors)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Request validation failed", "errors": errors},
    )


# Include API routers under /api
app.include_router(auth_router, prefix="/api")
app.include_router(workspaces_router, prefix="/api")
app.include_router(files_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "DevSync Backend",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    }
