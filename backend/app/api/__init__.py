"""API router assembly."""

from fastapi import APIRouter
from app.api.account import router as account_router
from app.api.cvs import router as cvs_router

from app.api.publication import router as publication_router
from app.api.presets import router as presets_router
from app.api.pdf import router as pdf_router

api_router = APIRouter()
api_router.include_router(cvs_router)
api_router.include_router(account_router)
api_router.include_router(publication_router)
api_router.include_router(presets_router)
api_router.include_router(pdf_router)

__all__ = ["api_router"]
