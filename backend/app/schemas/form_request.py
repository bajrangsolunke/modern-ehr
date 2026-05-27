"""
Pydantic schemas for the forms workflow. The on-disk payload is a
flexible JSONB column, but every write path validates against one of
the six per-type schemas below so the data stays queryable.
"""
from datetime import date, datetime
from typing import Annotated, Any, Literal, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


def _scrub_empty_strings(value: Any) -> Any:
    """Walk a JSON-ish structure and replace "" with None — Pydantic's
    date / int / etc. coercion can't handle "" but the FE sends it
    liberally for unfilled optional fields. Applied before validation
    so every per-type schema benefits."""
    if isinstance(value, str):
        return None if value == "" else value
    if isinstance(value, list):
        return [_scrub_empty_strings(v) for v in value]
    if isinstance(value, dict):
        return {k: _scrub_empty_strings(v) for k, v in value.items()}
    return value


FormTypeLiteral = Literal[
    "consent", "intake", "roi", "insurance", "discharge", "referral"
]
FormStatusLiteral = Literal["pending", "submitted", "completed", "denied"]


# ---------------------------------------------------------------- payloads


# ---------------------------------------------------------------- consent


class ConsentSignature(BaseModel):
    """A single signature block — typed name + date. Used in both the
    patient-consent section and the privacy-acknowledgement section."""

    signature: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=255)
    date: date


class ConsentContactPreferences(BaseModel):
    """Privacy-rules contact preferences — phone numbers + flags for
    how (or whether) the practice may reach the patient on each."""

    home_phone: str | None = Field(default=None, max_length=64)
    home_phone_ok_detailed: bool = False
    work_phone: str | None = Field(default=None, max_length=64)
    work_phone_callback_only: bool = False
    mobile_phone: str | None = Field(default=None, max_length=64)
    mobile_do_not_contact: bool = False
    email: str | None = Field(default=None, max_length=255)
    email_ok: bool = False


class ConsentPrivacyAcknowledgement(BaseModel):
    contact_preferences: ConsentContactPreferences = Field(
        default_factory=ConsentContactPreferences
    )
    only_disclose_to_me: bool = False
    signature_block: ConsentSignature


class ConsentFormPayload(BaseModel):
    form_type: Literal["consent"] = "consent"
    patient_consent: ConsentSignature
    """Acknowledges patient consent + financial responsibility blocks."""
    financial_acknowledged: bool = True
    privacy_acknowledgement: ConsentPrivacyAcknowledgement


# ---------------------------------------------------------------- intake


class IntakeDemographics(BaseModel):
    first_name: str = Field(min_length=1, max_length=128)
    middle_name: str | None = Field(default=None, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    suffix: str | None = Field(default=None, max_length=16)
    nickname: str | None = Field(default=None, max_length=128)
    gender_at_birth: str | None = Field(default=None, max_length=32)
    current_gender: str | None = Field(default=None, max_length=32)
    pronouns: str | None = Field(default=None, max_length=32)
    dob: date | None = None
    marital_status: str | None = Field(default=None, max_length=32)
    time_zone: str | None = Field(default=None, max_length=64)
    preferred_language: str | None = Field(default=None, max_length=64)
    occupation: str | None = Field(default=None, max_length=128)
    ssn: str | None = Field(default=None, max_length=32)
    race: str | None = Field(default=None, max_length=64)
    ethnicity: str | None = Field(default=None, max_length=64)


class IntakeContact(BaseModel):
    mobile_number: str | None = Field(default=None, max_length=64)
    home_number: str | None = Field(default=None, max_length=64)
    email: str | None = Field(default=None, max_length=255)
    fax_number: str | None = Field(default=None, max_length=64)
    address_line_1: str | None = Field(default=None, max_length=255)
    address_line_2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=128)
    state: str | None = Field(default=None, max_length=64)
    country: str | None = Field(default=None, max_length=64)
    zip_code: str | None = Field(default=None, max_length=16)


class IntakeInsurance(BaseModel):
    insurance_name: str | None = Field(default=None, max_length=255)
    member_id: str | None = Field(default=None, max_length=128)
    insurance_plan: str | None = Field(default=None, max_length=255)
    insured_group_name: str | None = Field(default=None, max_length=255)
    group_number: str | None = Field(default=None, max_length=128)
    effective_start_date: date | None = None
    effective_end_date: date | None = None
    # Data-URLs inline for the first ship — swap to object storage later.
    card_front_url: str | None = None
    card_back_url: str | None = None


class IntakePastSurgery(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    onset_date: date | None = None
    hospital: str | None = Field(default=None, max_length=255)
    note: str | None = Field(default=None, max_length=2000)


class IntakeMedication(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    frequency: str | None = Field(default=None, max_length=128)
    note: str | None = Field(default=None, max_length=2000)


class IntakeAllergy(BaseModel):
    type: str | None = Field(default=None, max_length=64)
    name: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class IntakeHealthHistory(BaseModel):
    childhood_illnesses: list[str] = Field(default_factory=list)
    diagnosed_problems: str | None = Field(default=None, max_length=4000)
    past_surgeries: list[IntakePastSurgery] = Field(default_factory=list)
    current_medications: list[IntakeMedication] = Field(default_factory=list)
    allergies: list[IntakeAllergy] = Field(default_factory=list)


class IntakeFamilyCondition(BaseModel):
    condition_name: str | None = Field(default=None, max_length=255)
    relation: str | None = Field(default=None, max_length=64)
    onset_date: date | None = None
    note: str | None = Field(default=None, max_length=2000)


class IntakeFamilyHistory(BaseModel):
    conditions: list[IntakeFamilyCondition] = Field(default_factory=list)


class IntakeFormPayload(BaseModel):
    form_type: Literal["intake"] = "intake"
    demographics: IntakeDemographics
    contact: IntakeContact = Field(default_factory=IntakeContact)
    insurance: IntakeInsurance = Field(default_factory=IntakeInsurance)
    health_history: IntakeHealthHistory = Field(default_factory=IntakeHealthHistory)
    family_health_history: IntakeFamilyHistory = Field(
        default_factory=IntakeFamilyHistory
    )


RoiCategory = Literal[
    "medical_records",
    "billing",
    "lab_results",
    "imaging",
    "clinical_notes",
    "discharge_summaries",
]


class RoiFormPayload(BaseModel):
    form_type: Literal["roi"] = "roi"
    releasing_to: str = Field(min_length=1, max_length=255)
    relationship: str = Field(min_length=1, max_length=128)
    info_categories: list[RoiCategory] = Field(min_length=1)
    valid_until: date
    patient_signature: str = Field(min_length=1, max_length=255)
    signed_date: date


class InsuranceFormPayload(BaseModel):
    form_type: Literal["insurance"] = "insurance"
    provider: str = Field(min_length=1, max_length=255)
    policy_number: str = Field(min_length=1, max_length=128)
    group_number: str | None = Field(default=None, max_length=128)
    subscriber_name: str = Field(min_length=1, max_length=255)
    subscriber_dob: date
    relationship_to_patient: str = Field(min_length=1, max_length=128)
    effective_date: date


class DischargeFormPayload(BaseModel):
    form_type: Literal["discharge"] = "discharge"
    discharge_diagnosis: str = Field(min_length=1, max_length=2000)
    discharge_date: date
    instructions: str = Field(min_length=1, max_length=4000)
    follow_up: str | None = Field(default=None, max_length=2000)
    medications_at_discharge: str | None = Field(default=None, max_length=2000)
    restrictions: str | None = Field(default=None, max_length=2000)


ReferralUrgency = Literal["routine", "urgent", "stat"]


class ReferralFormPayload(BaseModel):
    form_type: Literal["referral"] = "referral"
    referring_to_provider: str = Field(min_length=1, max_length=255)
    specialty: str = Field(min_length=1, max_length=128)
    reason: str = Field(min_length=1, max_length=2000)
    urgency: ReferralUrgency = "routine"
    relevant_history: str | None = Field(default=None, max_length=2000)
    referral_date: date


FormPayload = Annotated[
    Union[
        ConsentFormPayload,
        IntakeFormPayload,
        RoiFormPayload,
        InsuranceFormPayload,
        DischargeFormPayload,
        ReferralFormPayload,
    ],
    Field(discriminator="form_type"),
]


def validate_payload(form_type: str, data: dict[str, Any]) -> dict[str, Any]:
    """Validate (and round-trip) a payload against the right schema for
    its form_type. Returns the JSON-safe dict to persist.

    Empty strings are scrubbed to None before validation so the FE can
    submit a fully-populated object with blanks for unfilled optional
    fields without Pydantic choking on "" → date / int coercions."""
    scrubbed = _scrub_empty_strings(data)
    incoming = {**scrubbed, "form_type": form_type}
    cls_by_type: dict[str, type[BaseModel]] = {
        "consent": ConsentFormPayload,
        "intake": IntakeFormPayload,
        "roi": RoiFormPayload,
        "insurance": InsuranceFormPayload,
        "discharge": DischargeFormPayload,
        "referral": ReferralFormPayload,
    }
    cls = cls_by_type.get(form_type)
    if cls is None:
        raise ValueError(f"Unknown form_type {form_type!r}")
    return cls.model_validate(incoming).model_dump(mode="json")


# ---------------------------------------------------------------- API I/O


class FormRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    patient_name: str | None = None
    patient_mrn: str | None = None
    form_type: FormTypeLiteral
    status: FormStatusLiteral

    requested_by_user_id: UUID | None = None
    requested_by_name: str | None = None
    notes: str | None = None
    due_date: date | None = None

    data: dict[str, Any] | None = None
    submitted_at: datetime | None = None
    submitted_by_user_id: UUID | None = None
    submitted_by_name: str | None = None

    reviewed_at: datetime | None = None
    reviewed_by_user_id: UUID | None = None
    reviewed_by_name: str | None = None
    review_notes: str | None = None

    task_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class FormRequestCreate(BaseModel):
    patient_id: UUID
    form_type: FormTypeLiteral
    notes: str | None = Field(default=None, max_length=2000)
    due_date: date | None = None


class FormRequestSubmit(BaseModel):
    """Submit the filled form. The data shape is validated server-side
    against the matching per-type schema based on the request's
    form_type — that means the client only needs to send `data` and
    we'll reject anything that doesn't fit."""

    data: dict[str, Any]


class FormRequestReview(BaseModel):
    decision: Literal["completed", "denied"]
    review_notes: str | None = Field(default=None, max_length=2000)
