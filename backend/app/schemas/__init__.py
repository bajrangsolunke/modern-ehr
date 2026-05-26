from app.schemas.common import (
    HealthResponse,
    Page,
    Pagination,
    Token,
    TokenPayload,
)
from app.schemas.user import UserCreate, UserOut, UserUpdate, LoginRequest
from app.schemas.patient import (
    PatientCreate,
    PatientOut,
    PatientUpdate,
    PatientListItem,
    PatientFilters,
)
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentUpdate,
)
from app.schemas.soap_note import SoapNoteCreate, SoapNoteOut, SoapNoteUpdate
from app.schemas.medication import MedicationCreate, MedicationOut, MedicationUpdate
from app.schemas.vital import VitalCreate, VitalOut
from app.schemas.lab import LabCreate, LabOut
from app.schemas.document import DocumentOut, DocumentUploadResponse
from app.schemas.ai import (
    AiSummaryRequest,
    AiSummaryResponse,
    AiRiskScoreResponse,
    AiInsightOut,
    AiQuestionRequest,
    AiQuestionResponse,
)
from app.schemas.analytics import (
    KpiCard,
    BottleneckRow,
    TrendPoint,
    DashboardSnapshot,
)
from app.schemas.notification import NotificationOut, NotificationCreate

__all__ = [
    "HealthResponse",
    "Page",
    "Pagination",
    "Token",
    "TokenPayload",
    "UserCreate",
    "UserOut",
    "UserUpdate",
    "LoginRequest",
    "PatientCreate",
    "PatientOut",
    "PatientUpdate",
    "PatientListItem",
    "PatientFilters",
    "AppointmentCreate",
    "AppointmentOut",
    "AppointmentUpdate",
    "SoapNoteCreate",
    "SoapNoteOut",
    "SoapNoteUpdate",
    "MedicationCreate",
    "MedicationOut",
    "MedicationUpdate",
    "VitalCreate",
    "VitalOut",
    "LabCreate",
    "LabOut",
    "DocumentOut",
    "DocumentUploadResponse",
    "AiSummaryRequest",
    "AiSummaryResponse",
    "AiRiskScoreResponse",
    "AiInsightOut",
    "AiQuestionRequest",
    "AiQuestionResponse",
    "KpiCard",
    "BottleneckRow",
    "TrendPoint",
    "DashboardSnapshot",
    "NotificationOut",
    "NotificationCreate",
]
