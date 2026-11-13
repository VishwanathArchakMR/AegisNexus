from typing import Any, Dict, List, Set

SENSITIVE_KEY_PATTERNS = {
    "password",
    "passwd",
    "secret",
    "api_key",
    "apikey",
    "access_token",
    "token",
    "authorization",
    "auth",
    "private_key",
    "privkey",
    "ssn",
    "credit_card",
    "card_number",
    "cvv",
}

REDACTED_VALUE = "[REDACTED]"


def redact_sensitive_data(data: Any, max_depth: int = 5) -> Any:
    """
    Recursively redacts sensitive keys and values from dictionary and list structures.
    """
    if max_depth <= 0:
        return "[TRUNCATED_DEPTH]"

    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            key_str = str(key).lower()
            if any(pattern in key_str for pattern in SENSITIVE_KEY_PATTERNS):
                sanitized[key] = REDACTED_VALUE
            else:
                sanitized[key] = redact_sensitive_data(value, max_depth - 1)
        return sanitized

    elif isinstance(data, (list, tuple, set)):
        return [redact_sensitive_data(item, max_depth - 1) for item in data]

    elif isinstance(data, str):
        # Truncate overly long string payloads to prevent accidental dump of full context
        if len(data) > 1000:
            return data[:1000] + "... [TRUNCATED]"
        return data

    return data

