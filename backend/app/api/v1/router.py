from fastapi import APIRouter

from app.api.v1.endpoints import (
    ai,
    alerts,
    analytics,
    appointments,
    auth,
    availability,
    documents,
    health,
    labs,
    medications,
    messages,
    notes,
    notifications,
    patients,
    tasks,
    users,
    vitals,
    ws,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(availability.router)
api_router.include_router(patients.router)
api_router.include_router(appointments.router)
api_router.include_router(notes.router)
api_router.include_router(medications.router)
api_router.include_router(vitals.router)
api_router.include_router(alerts.router)
api_router.include_router(labs.router)
api_router.include_router(documents.router)
api_router.include_router(notifications.router)
api_router.include_router(analytics.router)
api_router.include_router(ai.router)
api_router.include_router(messages.router)
api_router.include_router(tasks.router)
api_router.include_router(ws.router)
