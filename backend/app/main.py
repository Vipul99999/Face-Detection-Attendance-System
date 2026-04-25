from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.routes import router
from app.api.v1.services.errors import ApiError, error_response_payload
from app.config.settings import settings
from app.core.db import initialize_database


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins) or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response_payload(
            message=exc.message,
            code=exc.code,
            details=exc.details,
        ),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        return JSONResponse(status_code=exc.status_code, content=detail)

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response_payload(
            message=str(detail or "Request failed."),
            code="HTTP_ERROR",
        ),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=error_response_payload(
            message="Request validation failed.",
            code="VALIDATION_ERROR",
            details=exc.errors(),
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, _exc: Exception):
    return JSONResponse(
        status_code=500,
        content=error_response_payload(
            message="Internal server error.",
            code="INTERNAL_SERVER_ERROR",
        ),
    )


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}


app.include_router(router, prefix="/api/v1")
