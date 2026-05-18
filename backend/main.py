from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine
from app.core.security import get_current_user
from app.api.routes import auth, users, goals, achievements, checkins, reports, cycles

# Event handlers
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()

# Initialize app
app = FastAPI(
    title="Goal Setting & Performance Tracking Portal",
    description="API for managing employee goals and performance tracking",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(goals.router, prefix="/api")
app.include_router(achievements.router, prefix="/api")
app.include_router(checkins.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(cycles.router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/test-auth")
async def test_auth(current_user = Depends(get_current_user)):
    return {
        "ok": True,
        "user_id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role
    }

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Goal Setting & Performance Tracking Portal",
        version="1.0.0",
        description="API for managing employee goals and performance tracking",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "Bearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT token obtained from /api/auth/login",
        }
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
