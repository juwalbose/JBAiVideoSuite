from pydantic import BaseModel
from typing import Optional, List

class StoryInput(BaseModel):
    rawInput: str
    narrativeArc: Optional[str] = None

class StoryOutput(BaseModel):
    id: str
    narrative_arc: str
    raw_input: Optional[str]

class Beat(BaseModel):
    id: str
    content: str
    order: int

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

# --- Settings Models ---

class LLMSettingsModel(BaseModel):
    ip: str
    port: int
    modelName: str
    temperature: float
    maxTokens: int

class BackendSettingsModel(BaseModel):
    apiUrl: str
    dbPath: str

class ComfyUISettingsModel(BaseModel):
    ip: str
    port: int
    deviceId: str
    pollInterval: int = 4000

# --- Handshake Model ---

class HandshakeResponse(BaseModel):
    status: str
    server_reachable: bool
    active_model: str
    ping_success: bool
    details: str
