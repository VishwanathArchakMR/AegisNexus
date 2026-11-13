from aegisnexus_sdk.redaction import redact_sensitive_data, REDACTED_VALUE


def test_redact_sensitive_keys():
    payload = {
        "user": "alice",
        "password": "supersecretpassword",
        "api_key": "sk-1234567890",
        "nested": {
            "token": "bearer-xyz",
            "safe_field": 42,
            "secret_token": "my-secret",
        },
        "list_items": [
            {"access_token": "abc", "status": "ok"},
            "plain string",
        ]
    }

    sanitized = redact_sensitive_data(payload)

    assert sanitized["user"] == "alice"
    assert sanitized["password"] == REDACTED_VALUE
    assert sanitized["api_key"] == REDACTED_VALUE
    assert sanitized["nested"]["token"] == REDACTED_VALUE
    assert sanitized["nested"]["safe_field"] == 42
    assert sanitized["nested"]["secret_token"] == REDACTED_VALUE
    assert sanitized["list_items"][0]["access_token"] == REDACTED_VALUE
    assert sanitized["list_items"][0]["status"] == "ok"
