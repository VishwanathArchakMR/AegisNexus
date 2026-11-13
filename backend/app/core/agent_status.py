from datetime import datetime, timezone
from typing import Tuple, Optional
from app.core.config import settings
from app.core.time import utc_now

# Administrative statuses
STATUS_ACTIVE = "ACTIVE"
STATUS_INACTIVE = "INACTIVE"
STATUS_QUARANTINED = "QUARANTINED"

# Connection statuses
CONNECTION_ONLINE = "ONLINE"
CONNECTION_STALE = "STALE"
CONNECTION_OFFLINE = "OFFLINE"
CONNECTION_NEVER_CONNECTED = "NEVER_CONNECTED"

# API Key statuses
KEY_STATUS_ACTIVE = "ACTIVE"
KEY_STATUS_REVOKED = "REVOKED"
KEY_STATUS_ROTATED = "ROTATED"

# Provenance types
PROVENANCE_SEEDED = "SEEDED"
PROVENANCE_SELF_REPORTED = "SELF_REPORTED"
PROVENANCE_OBSERVED = "OBSERVED"
PROVENANCE_VERIFIED = "VERIFIED"


def compute_connection_status(
    last_heartbeat_at: Optional[datetime],
    last_seen_at: Optional[datetime] = None,
    now: Optional[datetime] = None,
    stale_threshold_seconds: Optional[int] = None,
    offline_threshold_seconds: Optional[int] = None,
) -> Tuple[str, Optional[int]]:
    """
    Computes (connection_status, seconds_since_last_contact).
    Ensures connection state is strictly distinct from administrative status.
    """
    effective_last_contact = last_heartbeat_at or last_seen_at
    if effective_last_contact is None:
        return CONNECTION_NEVER_CONNECTED, None

    if now is None:
        now = utc_now()

    if effective_last_contact.tzinfo is None:
        effective_last_contact = effective_last_contact.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    seconds_elapsed = max(0, int((now - effective_last_contact).total_seconds()))

    stale_limit = stale_threshold_seconds or settings.HEARTBEAT_STALE_THRESHOLD_SECONDS
    offline_limit = offline_threshold_seconds or settings.HEARTBEAT_OFFLINE_THRESHOLD_SECONDS

    if seconds_elapsed <= stale_limit:
        return CONNECTION_ONLINE, seconds_elapsed
    elif seconds_elapsed <= offline_limit:
        return CONNECTION_STALE, seconds_elapsed
    else:
        return CONNECTION_OFFLINE, seconds_elapsed

