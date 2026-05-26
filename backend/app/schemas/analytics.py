from pydantic import BaseModel


class KpiCard(BaseModel):
    label: str
    value: float
    delta: float | None = None
    unit: str | None = None
    hint: str | None = None


class TrendPoint(BaseModel):
    label: str
    value: float | None = None
    series: dict[str, float] | None = None


class BottleneckRow(BaseModel):
    name: str
    percent_affected: str
    trend: str
    direction: str
    impact: str
    suggested_fix: str


class HeatmapCell(BaseModel):
    body_part: str
    values: list[int]


class DashboardSnapshot(BaseModel):
    kpis: list[KpiCard]
    bottlenecks: list[BottleneckRow]
    complication_trend: list[TrendPoint]
    proms_trend: list[TrendPoint]
    heatmap: list[HeatmapCell]
