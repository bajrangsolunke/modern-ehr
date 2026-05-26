from fastapi import APIRouter

from app.api.v1.endpoints import (
    ai,
    analytics,
    appointments,
    auth,
    documents,
    health,
    labs,
    medications,
    notes,
    notifications,
    patients,
    ws,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(patients.router)
api_router.include_router(appointments.router)
api_router.include_router(notes.router)
api_router.include_router(medications.router)
api_router.include_router(labs.router)
api_router.include_router(documents.router)
api_router.include_router(notifications.router)
api_router.include_router(analytics.router)
api_router.include_router(ai.router)
api_router.include_router(ws.router)
