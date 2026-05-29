"""Audit-log payload scrubber — verify sensitive fields are masked
before they ever reach the audit_logs.payload column."""
from app.services.audit_service import _scrub, _REDACTED


def test_scrubs_top_level_password():
    out = _scrub({"email": "x@y.com", "password": "hunter2"})
    assert out == {"email": "x@y.com", "password": _REDACTED}


def test_scrubs_nested_token():
    out = _scrub({"req": {"refresh_token": "abc", "ok": True}})
    assert out == {"req": {"refresh_token": _REDACTED, "ok": True}}


def test_scrubs_in_lists():
    out = _scrub({"items": [{"password": "p1"}, {"password": "p2"}]})
    assert out == {"items": [{"password": _REDACTED}, {"password": _REDACTED}]}


def test_leaves_neutral_fields():
    out = _scrub({"email": "x@y.com", "patient_id": "uuid", "status": "ok"})
    assert out == {"email": "x@y.com", "patient_id": "uuid", "status": "ok"}


def test_case_insensitive_match():
    out = _scrub({"Password": "x", "PASSWORD": "y", "TOKEN": "z"})
    assert out == {
        "Password": _REDACTED,
        "PASSWORD": _REDACTED,
        "TOKEN": _REDACTED,
    }


def test_redacts_phi_containers():
    # `data` is the free-form form-submission body; we don't want
    # raw form content sitting in audit_logs.
    out = _scrub({"form_id": "abc", "data": {"ssn": "111-22-3333"}})
    assert out == {"form_id": "abc", "data": _REDACTED}


def test_none_passthrough():
    assert _scrub(None) is None


def test_scalar_passthrough():
    assert _scrub("hello") == "hello"
    assert _scrub(42) == 42
    assert _scrub(True) is True
