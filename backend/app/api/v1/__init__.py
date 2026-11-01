"""API v1 router assembly."""

from fastapi import APIRouter
from app.api.v1.cvs import router as cvs_router

api_router = APIRouter()
api_router.include_router(cvs_router)
