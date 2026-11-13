from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CapabilityCreate(BaseModel):
    name: str
    resource_type: str = "API"  # EMAIL | DATABASE | PAYMENT | FILE | API | AGENT_COMMS
    permission: Optional[str] = None
    permission_level: str = "READ"  # READ | WRITE | EXECUTE | ADMIN
    is_sensitive: bool = False
    description: Optional[str] = None


class CapabilitySchema(BaseModel):
    id: str
    agent_id: str
    capability_name: str
    resource_type: str
    permission_level: str
    is_sensitive: bool
    description: Optional[str] = None
    provenance: str = "SELF_REPORTED"  # SELF_REPORTED | OBSERVED | VERIFIED | SEEDED
    last_observed_at: Optional[datetime] = None
    call_count: int = 0

    model_config = {"from_attributes": True}


class CapabilitySyncRequest(BaseModel):
    capabilities: List[CapabilityCreate]


class CapabilitySyncResponse(BaseModel):
    synced_count: int
    created_count: int
    updated_count: int
    capabilities: List[CapabilitySchema]


class CredentialSchema(BaseModel):
    id: str
    credential_name: str
    credential_type: str
    scope: str
    is_rotated: bool
    last_used_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RelationshipSchema(BaseModel):
    id: str
    source_agent_id: str
    target_agent_id: str
    relationship_type: str
    trust_direction: str
    description: Optional[str] = None
    provenance: str = "SEEDED"  # SEEDED | SELF_REPORTED | OBSERVED | VERIFIED
    last_interaction_at: Optional[datetime] = None
    interaction_count: int = 0
    last_event_id: Optional[str] = None

    model_config = {"from_attributes": True}


class AgentBasic(BaseModel):
    id: str
    name: str
    agent_type: str
    status: str
    trust_level: str
    owner_team: str
    source: str = "DEMO"
    discovery_method: str = "SEEDED"
    confidence: str = "SELF_REPORTED"
    last_seen_at: Optional[datetime] = None
    is_offline: bool = False
    connection_status: str = "NEVER_CONNECTED"

    model_config = {"from_attributes": True}


class AgentSummary(BaseModel):
    id: str
    name: str
    description: str
    agent_type: str
    status: str  # ACTIVE | INACTIVE | QUARANTINED
    trust_level: str  # CRITICAL | HIGH | MEDIUM | LOW
    owner_team: str
    created_at: datetime
    updated_at: datetime
    capability_count: int
    credential_count: int
    relationship_count: int
    source: str = "DEMO"  # DEMO | LIVE | EXTERNAL
    discovery_method: str = "SEEDED"  # SEEDED | SELF_REPORTED | ONBOARDED
    confidence: str = "SELF_REPORTED"
    last_seen_at: Optional[datetime] = None
    is_offline: bool = False
    connection_status: str = "NEVER_CONNECTED"  # ONLINE | STALE | OFFLINE | NEVER_CONNECTED
    framework: str = "custom"
    environment: str = "development"
    deployment_location: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    sdk_version: Optional[str] = None
    last_heartbeat_at: Optional[datetime] = None
    total_events_count: int = 0
    recent_errors_count: int = 0
    seconds_since_last_contact: Optional[int] = None

    model_config = {"from_attributes": True}


class AgentDetail(BaseModel):
    id: str
    name: str
    description: str
    agent_type: str
    status: str
    trust_level: str
    owner_team: str
    created_at: datetime
    updated_at: datetime
    capabilities: List[CapabilitySchema]
    credentials: List[CredentialSchema]
    outgoing_relationships: List[RelationshipSchema]
    incoming_relationships: List[RelationshipSchema]
    source: str = "DEMO"
    discovery_method: str = "SEEDED"
    confidence: str = "SELF_REPORTED"
    last_seen_at: Optional[datetime] = None
    is_offline: bool = False
    connection_status: str = "NEVER_CONNECTED"
    framework: str = "custom"
    environment: str = "development"
    deployment_location: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    sdk_version: Optional[str] = None
    api_key_status: str = "ACTIVE"
    api_key_created_at: Optional[datetime] = None
    api_key_revoked_at: Optional[datetime] = None
    heartbeat_interval_seconds: int = 30
    last_heartbeat_at: Optional[datetime] = None
    total_events_count: int = 0
    recent_errors_count: int = 0
    seconds_since_last_contact: Optional[int] = None

    model_config = {"from_attributes": True}


class OnboardAgentRequest(BaseModel):
    name: str
    description: str
    agent_type: str = "custom"
    framework: str = "custom"
    owner_team: str
    environment: str = "development"
    deployment_location: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    initial_trust_level: str = "LOW"
    capabilities: Optional[List[CapabilityCreate]] = None


class OnboardAgentResponse(BaseModel):
    agent_id: str
    name: str
    api_key: str  # One-time plaintext token
    api_key_status: str
    api_key_created_at: datetime
    environment: str
    framework: str
    trust_level: str
    heartbeat_interval_seconds: int
    endpoint: str


class RegisterRequest(BaseModel):
    name: str
    agent_type: str = "custom"
    description: str
    owner_team: str
    trust_level: str = "LOW"
    framework: Optional[str] = "custom"
    environment: Optional[str] = "development"
    capabilities: Optional[List[dict]] = None


class RegisterResponse(BaseModel):
    agent_id: str
    api_key: str


class KeyRotationResponse(BaseModel):
    agent_id: str
    new_api_key: str
    api_key_status: str
    rotated_at: datetime


class KeyRevocationResponse(BaseModel):
    agent_id: str
    api_key_status: str
    revoked_at: datetime


class HeartbeatRequest(BaseModel):
    status: str = "ACTIVE"
    timestamp: Optional[datetime] = None
    sdk_version: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None


class HeartbeatResponse(BaseModel):
    status: str
    acknowledged_at: datetime
    connection_status: str


class EventRequest(BaseModel):
    event_id: Optional[str] = None
    event_type: str
    tool: Optional[str] = None
    action: Optional[str] = None
    resource_type: Optional[str] = None
    permission_level: Optional[str] = None
    status: str = "SUCCESS"
    timestamp: Optional[datetime] = None
    payload: Optional[str] = None
    duration_ms: Optional[float] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    parent_span_id: Optional[str] = None
    target_agent_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    sdk_version: Optional[str] = None


class BatchEventRequest(BaseModel):
    events: List[EventRequest]


class EventIngestResponse(BaseModel):
    status: str
    event_id: str
    detection_triggered: bool = False
    finding_id: Optional[str] = None


class BatchEventIngestResponse(BaseModel):
    status: str
    processed_count: int
    deduplicated_count: int
    detections_count: int
    event_ids: List[str]


class AgentEventDetail(BaseModel):
    id: str
    agent_id: str
    event_type: str
    tool: Optional[str] = None
    action: Optional[str] = None
    resource_type: Optional[str] = None
    permission_level: Optional[str] = None
    status: str
    payload: Optional[str] = None
    duration_ms: Optional[float] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    parent_span_id: Optional[str] = None
    target_agent_id: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    sdk_version: Optional[str] = None
    event_source: str = "SDK"
    created_at: datetime
    server_received_at: datetime

    model_config = {"from_attributes": True}


class AgentEventListResponse(BaseModel):
    events: List[AgentEventDetail]
    total: int
    page: int
    page_size: int


class ConnectionStatusResponse(BaseModel):
    agent_id: str
    agent_name: str
    connection_status: str
    administrative_status: str
    last_heartbeat_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    seconds_since_last_contact: Optional[int] = None
    heartbeat_interval_seconds: int = 30
    stale_threshold_seconds: int = 60
    offline_threshold_seconds: int = 90
    total_events: int = 0
    recent_errors: int = 0


class AgentListResponse(BaseModel):
    agents: List[AgentSummary]
    total: int
