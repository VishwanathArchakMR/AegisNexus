from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class CapabilitySchema(BaseModel):
    id: str
    capability_name: str
    resource_type: str
    permission_level: str
    is_sensitive: bool
    description: Optional[str] = None

    model_config = {"from_attributes": True}


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

    model_config = {"from_attributes": True}


class AgentSummary(BaseModel):
    id: str
    name: str
    description: str
    agent_type: str
    status: str
    trust_level: str
    owner_team: str
    created_at: datetime
    updated_at: datetime
    capability_count: int
    credential_count: int
    relationship_count: int
    source: str = "DEMO"
    discovery_method: str = "SEEDED"
    confidence: str = "SELF_REPORTED"
    last_seen_at: Optional[datetime] = None
    is_offline: bool = False


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

    model_config = {"from_attributes": True}

class RegisterRequest(BaseModel):
    name: str
    agent_type: str
    description: str
    owner_team: str
    trust_level: str
    capabilities: Optional[List[dict]] = None
    
class RegisterResponse(BaseModel):
    agent_id: str
    api_key: str

class HeartbeatRequest(BaseModel):
    status: str
    timestamp: datetime

class EventRequest(BaseModel):
    event_type: str
    tool: Optional[str] = None
    action: Optional[str] = None
    status: str
    timestamp: datetime
    payload: Optional[str] = None


class AgentListResponse(BaseModel):
    agents: List[AgentSummary]
    total: int
