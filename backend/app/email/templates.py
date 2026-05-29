"""HTML + plaintext templates for transactional emails. Kept as Python
strings (no Jinja yet — only two templates, easier to maintain). Each
function returns `(subject, html, text)`.

Replace inline styles with proper templates if email volume grows."""
from __future__ import annotations

from datetime import datetime


def _brand_html(body_html: str) -> str:
    """Tiny brand wrapper. Tables, not flexbox — email clients are
    stuck in 2005."""
    return f"""\
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f4f6fb;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="padding:32px 40px 16px 40px;">
          <div style="font-size:14px;font-weight:700;color:#4D9FFF;letter-spacing:0.02em;">PADMAVAT HEALTH</div>
        </td></tr>
        <tr><td style="padding:0 40px 32px 40px;font-size:15px;line-height:1.55;color:#1f2937;">
          {body_html}
        </td></tr>
        <tr><td style="padding:16px 40px 32px 40px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
          This is a transactional email from Padmavat Health. If you didn't expect this, you can ignore it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def patient_invite(
    *, patient_name: str, setup_url: str, expires_at: datetime
) -> tuple[str, str, str]:
    expires_str = expires_at.strftime("%b %d, %Y at %I:%M %p UTC")
    subject = f"Welcome to your Padmavat patient portal, {patient_name}"
    html = _brand_html(f"""\
<h2 style="margin:0 0 12px 0;font-size:20px;color:#111827;">Welcome, {patient_name}!</h2>
<p>Your care team has invited you to the Padmavat patient portal. There you can review your appointments, message your provider, and complete intake forms before your visit.</p>
<p style="text-align:center;margin:24px 0;">
  <a href="{setup_url}" style="display:inline-block;padding:12px 24px;background:#4D9FFF;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;">Set up your account</a>
</p>
<p style="font-size:13px;color:#6b7280;">Or paste this link into your browser:<br>
  <a href="{setup_url}" style="color:#4D9FFF;word-break:break-all;">{setup_url}</a>
</p>
<p style="font-size:12px;color:#9ca3af;">This link expires {expires_str}.</p>
""")
    text = (
        f"Welcome, {patient_name}!\n\n"
        f"Your care team has invited you to the Padmavat patient portal.\n\n"
        f"Set up your account: {setup_url}\n\n"
        f"This link expires {expires_str}.\n"
    )
    return subject, html, text


def user_invite(
    *, full_name: str, setup_url: str, expires_at: datetime, role: str
) -> tuple[str, str, str]:
    expires_str = expires_at.strftime("%b %d, %Y at %I:%M %p UTC")
    subject = f"Set up your Padmavat staff account, {full_name}"
    html = _brand_html(f"""\
<h2 style="margin:0 0 12px 0;font-size:20px;color:#111827;">Hi {full_name},</h2>
<p>An administrator has added you to Padmavat Health as a <strong>{role}</strong>. Use the link below to set your password and finish account setup.</p>
<p style="text-align:center;margin:24px 0;">
  <a href="{setup_url}" style="display:inline-block;padding:12px 24px;background:#4D9FFF;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;">Set up your account</a>
</p>
<p style="font-size:13px;color:#6b7280;">Or paste this link into your browser:<br>
  <a href="{setup_url}" style="color:#4D9FFF;word-break:break-all;">{setup_url}</a>
</p>
<p style="font-size:12px;color:#9ca3af;">This link expires {expires_str}.</p>
""")
    text = (
        f"Hi {full_name},\n\n"
        f"An administrator has added you to Padmavat Health as a {role}.\n\n"
        f"Set up your account: {setup_url}\n\n"
        f"This link expires {expires_str}.\n"
    )
    return subject, html, text
