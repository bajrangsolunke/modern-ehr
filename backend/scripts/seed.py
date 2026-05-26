"""Seed the database with realistic demo data for local development."""
from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models import (
    Allergy,
    Appointment,
    AppointmentStatus,
    AppointmentType,
    Condition,
    LabResult,
    Medication,
    MedicationStatus,
    Patient,
    PatientStatus,
    RiskLevel,
    SoapNote,
    User,
    UserRole,
)


async def reset_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # Users
        users = [
            User(
                email="robert.fox@symptra.health",
                hashed_password=hash_password("symptra123"),
                full_name="Dr. Robert Fox",
                role=UserRole.surgeon,
                specialty="Orthopedics & Trauma Surgery",
            ),
            User(
                email="leslie@symptra.health",
                hashed_password=hash_password("symptra123"),
                full_name="Dr. Leslie Alexander",
                role=UserRole.physician,
                specialty="Orthopedic Surgeon",
            ),
            User(
                email="jane@symptra.health",
                hashed_password=hash_password("symptra123"),
                full_name="Dr. Jane Cooper",
                role=UserRole.physician,
                specialty="Anesthesiologist",
            ),
        ]
        db.add_all(users)
        await db.flush()
        physician = users[0]

        # Patients
        emma = Patient(
            mrn="1001",
            first_name="Emma",
            last_name="Johnson",
            sex="F",
            dob=date(1962, 3, 12),
            city="Berlin, Germany",
            procedure="Hip Replacement",
            procedure_date=date(2025, 4, 28),
            asa="II",
            icu_needed=True,
            status=PatientStatus.ready,
            risk=RiskLevel.high,
            risk_score=72,
            tags=["#ASA II", "#ICU needed", "#High Risk"],
            assigned_physician_id=users[1].id,
        )
        jacob = Patient(
            mrn="1002",
            first_name="Jacob",
            last_name="Miller",
            sex="M",
            dob=date(1966, 8, 4),
            procedure="Cardiac Bypass",
            procedure_date=date(2025, 5, 1),
            asa="IV",
            icu_needed=True,
            status=PatientStatus.at_risk,
            risk=RiskLevel.critical,
            risk_score=88,
            tags=["#ASA IV", "#High Risk", "#ICU required"],
            assigned_physician_id=users[2].id,
        )
        dianne = Patient(
            mrn="3456",
            first_name="Dianne",
            last_name="Russell",
            sex="F",
            dob=date(1995, 2, 12),
            city="Berlin, Germany",
            procedure="Hip Replacement (Right) - OPS 5-820.00",
            procedure_date=date(2025, 5, 15),
            asa="III",
            icu_needed=True,
            status=PatientStatus.scheduled,
            risk=RiskLevel.high,
            risk_score=65,
            tags=["#ASA III", "#ICU pending"],
            assigned_physician_id=physician.id,
        )
        db.add_all([emma, jacob, dianne])
        await db.flush()

        # Allergies + conditions for Dianne
        db.add_all(
            [
                Allergy(patient_id=dianne.id, substance="Latex"),
                Allergy(patient_id=dianne.id, substance="Penicillin"),
                Condition(patient_id=dianne.id, name="Diabetes Type II", icd10="E11"),
                Condition(patient_id=dianne.id, name="Hypertonie", icd10="I10"),
            ]
        )

        # Medications
        db.add_all(
            [
                Medication(
                    patient_id=dianne.id,
                    name="Apixaban",
                    dose="5 mg",
                    frequency="BID",
                    route="oral",
                    status=MedicationStatus.paused,
                    prescriber="Dr. Müller",
                    start_date=date(2025, 4, 20),
                ),
                Medication(
                    patient_id=dianne.id,
                    name="Metformin",
                    dose="850 mg",
                    frequency="BID",
                    route="oral",
                    status=MedicationStatus.active,
                    prescriber="Dr. Weber",
                    start_date=date(2024, 11, 12),
                ),
            ]
        )

        # Labs
        db.add_all(
            [
                LabResult(
                    patient_id=dianne.id,
                    name="Hemoglobin",
                    value="13.4",
                    unit="g/dL",
                    reference_range="12.0-15.5",
                ),
                LabResult(
                    patient_id=dianne.id,
                    name="INR",
                    value="1.8",
                    unit="",
                    reference_range="0.8-1.2",
                    flag="H",
                ),
                LabResult(
                    patient_id=dianne.id,
                    name="HbA1c",
                    value="7.8",
                    unit="%",
                    reference_range="<7.0",
                    flag="H",
                ),
            ]
        )

        # Appointment + SOAP note
        db.add(
            Appointment(
                patient_id=dianne.id,
                physician_id=physician.id,
                type=AppointmentType.surgery,
                status=AppointmentStatus.confirmed,
                starts_at=datetime(2025, 5, 15, 8, 0, tzinfo=timezone.utc),
                duration_minutes=180,
                room="OR-04",
            )
        )
        db.add(
            SoapNote(
                patient_id=dianne.id,
                author_id=physician.id,
                subjective="Persistent right hip pain (7/10).",
                objective="Limited ROM. Trendelenburg positive.",
                assessment="Advanced OA right hip.",
                plan="THA on 15.05.2025. Pause apixaban 48h pre-op.",
                ai_summary=(
                    "Surgical candidate for THA. Anticoagulation bridge required. "
                    "ICU bed recommended given ASA III + cardiac history."
                ),
            )
        )

        await db.commit()
        print("Seeded.")


async def main() -> None:
    await reset_schema()
    await seed()


if __name__ == "__main__":
    asyncio.run(main())
