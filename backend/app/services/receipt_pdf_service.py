"""PDF receipt generator. ReportLab Platypus → bytes. Pure function:
takes a fully-projected Invoice + its child Charges + succeeded
Payments and renders a Letter-size PDF. No DB access here so the
service can be tested with hand-built dataclasses.
"""
from __future__ import annotations

from io import BytesIO
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.config import settings
from app.models.charge import Charge
from app.models.invoice import Invoice
from app.models.payment import Payment


def _cents(c: int) -> str:
    """Format an integer-cents amount as USD: 12500 -> '$125.00'."""
    sign = "-" if c < 0 else ""
    absc = abs(c)
    return f"{sign}${absc // 100}.{absc % 100:02d}"


def render_receipt(
    invoice: Invoice,
    charges: Iterable[Charge],
    payments: Iterable[Payment],
    *,
    patient_name: str,
) -> bytes:
    """Render a Letter-size PDF receipt. Returns the binary PDF body."""
    charges = list(charges)
    payments = list(payments)

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
        title=f"Receipt {invoice.number}",
        author=settings.PRACTICE_NAME or "Modern-EHR Clinic",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], fontSize=20, spaceAfter=4)
    small = ParagraphStyle(
        "small", parent=styles["Normal"], fontSize=9, textColor=colors.grey
    )
    body = styles["Normal"]

    elems: list = []

    # Header — practice block.
    elems.append(Paragraph(settings.PRACTICE_NAME or "Modern-EHR Clinic", h1))
    if settings.PRACTICE_ADDRESS:
        elems.append(Paragraph(settings.PRACTICE_ADDRESS, small))
    if settings.PRACTICE_PHONE:
        elems.append(Paragraph(settings.PRACTICE_PHONE, small))
    elems.append(Spacer(1, 12))

    # Invoice meta.
    elems.append(Paragraph(f"<b>Invoice {invoice.number}</b>", body))
    issued = (
        invoice.issued_at.strftime("%b %d, %Y") if invoice.issued_at else "-"
    )
    elems.append(Paragraph(f"Issued: {issued}", small))
    elems.append(Paragraph(f"Patient: {patient_name}", body))
    elems.append(Spacer(1, 14))

    # Line items.
    rows = [["Description", "Code", "Qty", "Unit", "Discount", "Tax", "Total"]]
    for c in charges:
        rows.append(
            [
                c.description,
                c.code,
                str(c.quantity),
                _cents(c.unit_price_cents),
                _cents(c.discount_cents),
                _cents(c.tax_cents),
                _cents(c.total_cents),
            ]
        )
    tbl = Table(
        rows,
        colWidths=[
            2.2 * inch,
            0.8 * inch,
            0.5 * inch,
            0.7 * inch,
            0.8 * inch,
            0.6 * inch,
            0.8 * inch,
        ],
    )
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#F8FAFC")],
                ),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ]
        )
    )
    elems.append(tbl)
    elems.append(Spacer(1, 14))

    # Totals box.
    totals = Table(
        [
            ["Subtotal", _cents(invoice.subtotal_cents)],
            ["Discount", _cents(invoice.discount_cents)],
            ["Tax", _cents(invoice.tax_cents)],
            ["Total", _cents(invoice.total_cents)],
            ["Paid", _cents(invoice.paid_cents)],
            ["Balance", _cents(invoice.balance_cents)],
        ],
        colWidths=[1.4 * inch, 1.0 * inch],
        hAlign="RIGHT",
    )
    totals.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
                ("LINEABOVE", (0, 3), (-1, 3), 0.5, colors.black),
                ("LINEABOVE", (0, 5), (-1, 5), 0.5, colors.black),
            ]
        )
    )
    elems.append(totals)

    # Payments history (only succeeded).
    succeeded = [p for p in payments if p.status == "succeeded"]
    if succeeded:
        elems.append(Spacer(1, 14))
        elems.append(Paragraph("<b>Payments</b>", body))
        pay_rows = [["Date", "Method", "Amount", "Ref"]]
        for p in succeeded:
            ref = (
                p.reference
                or (f"•••• {p.last4}" if p.last4 else (p.stripe_charge_id or ""))
            )
            pay_rows.append(
                [
                    p.created_at.strftime("%b %d, %Y"),
                    p.method,
                    _cents(p.amount_cents),
                    ref,
                ]
            )
        pt = Table(
            pay_rows,
            colWidths=[1.0 * inch, 1.0 * inch, 1.0 * inch, 2.0 * inch],
        )
        pt.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                ]
            )
        )
        elems.append(pt)

    elems.append(Spacer(1, 18))
    elems.append(
        Paragraph(
            "Thank you for your visit. Questions about this receipt? Contact our front desk.",
            small,
        )
    )

    doc.build(elems)
    return buf.getvalue()
