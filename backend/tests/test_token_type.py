from app.core.security import create_access_token, create_refresh_token, decode_token


def test_default_token_type_is_user():
    token = create_access_token("u-123")
    payload = decode_token(token)
    assert payload["token_type"] == "user"


def test_token_type_can_be_overridden():
    token = create_access_token("p-456", token_type="patient")
    payload = decode_token(token)
    assert payload["token_type"] == "patient"
    assert payload["sub"] == "p-456"


def test_refresh_token_carries_type_too():
    token = create_refresh_token("p-456", token_type="patient")
    payload = decode_token(token)
    assert payload["type"] == "refresh"
    assert payload["token_type"] == "patient"
