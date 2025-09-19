from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.routes import router
from app.config.settings import settings

app = FastAPI(title=settings.APP_NAME)

# Enable CORS (⚠️ in production, restrict origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ["http://localhost:5173"] for Vite frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
app.include_router(router, prefix="/api/v1")
