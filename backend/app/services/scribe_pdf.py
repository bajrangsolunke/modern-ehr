"""PDF renderer for a completed scribe session.

Uses ReportLab SimpleDocTemplate to produce a clean single-page or
multi-page clinical summary. Kept as a pure function (no DB I/O) so
the endpoint can test it easily and swap renderers later.
"""
from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.patient import Patient
from app.models.scribe_session import ScribeSession

TRANSCRIPT_MAX_CHARS = 2000


def render_session_pdf(session: ScribeSession, patient: Patient) -> bytes:
    """Render a scribe session as a PDF and return the raw bytes."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()

    heading1 = ParagraphStyle(
        "heading1",
        parent=styles["Heading1"],
        fontSize=16,
        spaceAfter=4,
    )
    heading2 = ParagraphStyle(
        "heading2",
        parent=styles["Heading2"],
        fontSize=12,
        spaceBefore=10,
        spaceAfter=4,
    )
    normal = styles["Normal"]
    small = ParagraphStyle("small", parent=normal, fontSize=9)

    story = []

    # ---- Header -------------------------------------------------------
    patient_name = f"{patient.first_name} {patient.last_name}"
    date_str = (
        session.started_at.strftime("%Y-%m-%d %H:%M UTC")
        if session.started_at
        else "Unknown"
    )
    story.append(Paragraph("Scribe Session Report", heading1))
    story.append(
        Paragraph(
            f"<b>Patient:</b> {patient_name} &nbsp;&nbsp; "
            f"<b>MRN:</b> {patient.mrn} &nbsp;&nbsp; "
            f"<b>Date:</b> {date_str}",
            normal,
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
    story.append(Spacer(1, 0.1 * inch))

    # ---- Chief Complaint ----------------------------------------------
    if session.chief_complaint:
        story.append(Paragraph("Chief Complaint", heading2))
        story.append(Paragraph(session.chief_complaint, normal))
        story.append(Spacer(1, 0.05 * inch))

    # ---- Transcript ---------------------------------------------------
    story.append(Paragraph("Transcript", heading2))
    transcript = session.transcript_text or "(no transcript)"
    truncated = False
    if len(transcript) > TRANSCRIPT_MAX_CHARS:
        transcript = transcript[:TRANSCRIPT_MAX_CHARS]
        truncated = True
    story.append(Paragraph(transcript.replace("\n", "<br/>"), normal))
    if truncated:
        story.append(Paragraph("… (truncated)", small))
    story.append(Spacer(1, 0.05 * inch))

    # ---- SOAP ---------------------------------------------------------
    soap = session.soap_note
    story.append(Paragraph("SOAP Note", heading2))
    if soap:
        for label, value in [
            ("Subjective", soap.subjective),
            ("Objective", soap.objective),
            ("Assessment", soap.assessment),
            ("Plan", soap.plan),
        ]:
            story.append(
                Paragraph(f"<b>{label}:</b> {value or '—'}", normal)
            )
            story.append(Spacer(1, 0.04 * inch))
    else:
        story.append(Paragraph("(not yet generated)", normal))
    story.append(Spacer(1, 0.05 * inch))

    # ---- ICD Codes ----------------------------------------------------
    story.append(Paragraph("ICD-10 Suggestions", heading2))
    suggestions = getattr(session, "icd_suggestions", []) or []
    if suggestions:
        data = [["Code", "Description", "Validated", "Accepted"]]
        for s in suggestions:
            data.append([
                s.code,
                s.description[:60] + ("…" if len(s.description) > 60 else ""),
                "Yes" if s.is_validated else "No",
                "Yes" if s.accepted_by_user else "No",
            ])
        tbl = Table(data, colWidths=[0.9 * inch, 3.5 * inch, 0.9 * inch, 0.9 * inch])
        tbl.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4a90d9")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        story.append(tbl)
    else:
        story.append(Paragraph("(none)", normal))
    story.append(Spacer(1, 0.05 * inch))

    # ---- Visit Summary ------------------------------------------------
    if session.visit_summary:
        story.append(Paragraph("Visit Summary", heading2))
        story.append(Paragraph(session.visit_summary, normal))

    doc.build(story)
    return buf.getvalue()
