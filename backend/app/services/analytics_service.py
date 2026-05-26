from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus
from app.models.patient import Patient, PatientStatus, RiskLevel
from app.schemas.analytics import (
    BottleneckRow,
    DashboardSnapshot,
    HeatmapCell,
    KpiCard,
    TrendPoint,
)


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def snapshot(self) -> DashboardSnapshot:
        total_patients = await self.db.scalar(select(func.count(Patient.id))) or 0
        at_risk = (
            await self.db.scalar(
                select(func.count(Patient.id)).where(Patient.risk == RiskLevel.high)
            )
            or 0
        )
        ready = (
            await self.db.scalar(
                select(func.count(Patient.id)).where(Patient.status == PatientStatus.ready)
            )
            or 0
        )
        confirmed = (
            await self.db.scalar(
                select(func.count(Appointment.id)).where(
                    Appointment.status == AppointmentStatus.confirmed
                )
            )
            or 0
        )

        kpis = [
            KpiCard(label="Total patients", value=float(total_patients), delta=2.4),
            KpiCard(label="Ready for OR", value=float(ready), delta=1.1),
            KpiCard(label="High-risk", value=float(at_risk), delta=-0.3),
            KpiCard(label="Confirmed appts", value=float(confirmed), delta=4.2),
        ]

        bottlenecks = [
            BottleneckRow(
                name="Late starts",
                percent_affected="39%",
                trend="+7%",
                direction="up",
                impact="Procedure delays",
                suggested_fix="Start checklist earlier (T-3)",
            ),
            BottleneckRow(
                name="OP-Bench delay",
                percent_affected="24%",
                trend="-3%",
                direction="down",
                impact="Billing & compliance risk",
                suggested_fix="Add upload reminders",
            ),
            BottleneckRow(
                name="Low PROM return",
                percent_affected="61% (goal 80%)",
                trend="+13%",
                direction="up",
                impact="Incomplete outcomes",
                suggested_fix="Enable SMS nudge",
            ),
            BottleneckRow(
                name="Dept C complications",
                percent_affected="8.2% vs 3.4% avg",
                trend="-25%",
                direction="down",
                impact="Patient safety",
                suggested_fix="Review SOPs and case mix",
            ),
        ]

        complication_trend = [
            TrendPoint(label=lbl, value=val)
            for lbl, val in [
                ("Feb W1", 28),
                ("Feb W2", 32),
                ("Feb W3", 26),
                ("Feb W4", 30),
                ("Mar W1", 40),
                ("Mar W2", 38),
                ("Mar W3", 55),
                ("Mar W4", 34),
                ("Apr W1", 28),
                ("Apr W2", 25),
                ("Apr W3", 22),
            ]
        ]

        proms_trend = [
            TrendPoint(
                label="Feb",
                series={"satisfaction": 7.4, "mobility": 6.2, "pain": 4.1},
            ),
            TrendPoint(
                label="Mar",
                series={"satisfaction": 7.0, "mobility": 6.5, "pain": 4.2},
            ),
            TrendPoint(
                label="Apr",
                series={"satisfaction": 7.8, "mobility": 7.0, "pain": 3.5},
            ),
        ]

        heatmap = [
            HeatmapCell(body_part="Hand", values=[1, 2, 1, 3, 2, 4]),
            HeatmapCell(body_part="Foot", values=[3, 2, 4, 2, 1, 3]),
            HeatmapCell(body_part="Ankle", values=[2, 4, 5, 3, 2, 2]),
            HeatmapCell(body_part="Shoulder", values=[1, 3, 4, 4, 2, 5]),
            HeatmapCell(body_part="Knee", values=[4, 5, 3, 4, 5, 4]),
            HeatmapCell(body_part="Hip", values=[3, 2, 4, 3, 2, 5]),
        ]

        return DashboardSnapshot(
            kpis=kpis,
            bottlenecks=bottlenecks,
            complication_trend=complication_trend,
            proms_trend=proms_trend,
            heatmap=heatmap,
        )
