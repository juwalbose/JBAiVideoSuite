from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import requests
import json
import asyncio

# Import Prisma (We will assume prisma-client-python is installed)
from prisma import Prisma

db = Prisma()

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="BionicProducer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---

class StoryInput(BaseModel):
    original_idea: str
    narrative_arc: Optional[str] = None

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

# --- Handshake Model ---

class HandshakeResponse(BaseModel):
    status: str
    server_reachable: bool
    active_model: str
    ping_success: bool
    details: str

# --- Helper Functions ---

def call_llm(prompt: str) -> str:
    """Helper to call LM Studio's local LLM using the OpenAI SDK."""
    url = "http://192.168.1.66:1234/v1/chat/completions"
    payload = {
        "model": "gemma-4-e4b-uncensored-hauhaucs-aggressive", 
        "messages": [
            {"role": "system", "content": "You are a creative video production assistant."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
    }
    try:
        response = requests.post(url, json=payload)
        print(f'DEBUG: Request sent to {url}')
        print(f'DEBUG: Response Status Code: {response.status_code}')
        response.raise_for_status()
        result = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        print(f'DEBUG: LLM Result received: {result[:50]}...')
        return result
    except Exception as e:
        print(f'DEBUG: Error in call_llm: {e}')
        return f"LM Studio Error: {str(e)}"

# --- Startup/Shutdown Events ---

@app.on_event("startup")
async def startup():
    await db.connect()

@app.on_event("shutdown")
async def shutdown():
    await db.disconnect()

# --- Endpoints ---

@app.get("/handshake", response_model=HandshakeResponse)
async def check_lmstudio_health():
    LM_STUDIO_HOST = "192.168.1.66"
    LM_STUDIO_PORT = 1234
    BASE_URL = f"http://{LM_STUDIO_HOST}:{LM_STUDIO_PORT}/v1"

    try:
        # 1. Check reachability and fetch loaded models
        models_response = requests.get(f"{BASE_URL}/models")
        if models_response.status_code != 200:
            return HandshakeResponse(
                status="unhealthy",
                server_reachable=False,
                active_model="unknown",
                ping_success=False,
                details=f"LM Studio responded with HTTP {models_response.status_code}"
            )

        data = models_response.json()
        model_list = data.get("data", [])
        
        if not model_list:
            return HandshakeResponse(
                status="no_models",
                server_reachable=True,
                active_model="No Model Loaded",
                ping_success=True,
                details="LM Studio is ready, but no models are loaded."
            )

        active_model = model_list[0].get("name", "Unnamed Model")

        return HandshakeResponse(
            status="healthy",
            server_reachable=True,
            active_model=active_model,
            ping_success=True,
            details="LM Studio is ready."
        )
    except Exception as e:
        return HandshakeResponse(
            status="unhealthy",
            server_reachable=False,
            active_model="unknown",
            ping_success=False,
            details=str(e)
        )

# --- Settings Endpoints ---

@app.get("/settings/")
async def get_settings():
    """Fetch all settings from the database."""
    return {
        "llm": {
            "ip": "192.168.1.66",
            "port": 1234,
            "modelName": "gemma-4-e4b-uncensored-hauhaucs-aggressive",
            "temperature": 0.7,
            "maxTokens": 512,
        },
        "backend": {
            "apiUrl": "http://127.0.0.1:8000",
            "dbPath": "backend/prisma/database.db",
        },
        "comfyui": {
            "ip": "127.0.0.1",
            "port": 8188,
            "deviceId": "0",
        }
    }

@app.post("/settings/save-llm")
async def save_llm_settings(settings: LLMSettingsModel):
    print(f"DEBUG: Saving LLM Settings: {settings}")
    return {"status": "success", "data": settings}

@app.post("/settings/save-backend")
async def save_backend_settings(settings: BackendSettingsModel):
    print(f"DEBUG: Saving Backend Settings: {settings}")
    return {"status": "success", "data": settings}

@app.post("/settings/save-comfyui")
async def save_comfyui_settings(settings: ComfyUISettingsModel):
    print(f"DEBUG: Saving ComfyUI Settings: {settings}")
    return {"status": "success", "data": settings}

# --- New LLM Test Endpoint ---

@app.get("/llm-test")
async def test_llm():
    """Proxy endpoint to fetch models from LM Studio, bypassing browser CORS issues."""
    ip = "192.168.1.66"
    port = 1234
    url = f"http://{ip}:{port}/v1/models"
    
    try:
        response = requests.get(url)
        if response.status_code != 200:
            return {"status": "error", "details": f"HTTP {response.status_code}"}
        
        data = response.json()
        # Ensure we grab the list of models correctly from the LM Studio JSON structure
        model_list = data.get("data", [])
        
        if not model_list:
            return {"status": "no_models", "models": [], "details": "No models found in 'data' key."}

        # Return a clean list of IDs for the frontend to consume easily
        return {
            "status": "healthy",
            "models": [m.get("id") for m in model_list],
            "details": f"{len(model_list)} models loaded.",
            "raw_data": data
        }
    except Exception as e:
        return {"status": "unhealthy", "details": str(e), "raw_error": str(e)}

# --- Project Endpoints ---

@app.get("/projects/")
async def list_projects():
    try:
        projects = await db.project.find_many(include={'story': {}})
        return [p.dict() for p in projects]
    except Exception as e:
        print(f"DEBUG: Error fetching projects: {e}")
        return []

@app.post("/projects/")
async def create_project(project: ProjectCreate):
    new_project = await db.project.create({
        'name': project.name,
        'description': project.description
    })
    return new_project.dict()

@app.patch("/projects/{id}")
async def update_project(id: str, name: str, description: Optional[str] = None):
    updated_project = await db.project.update({
        'where': {'id': id},
        'data': {
            'name': name,
            'description': description
        }
    })
    return updated_project.dict()

@app.post("/projects/delete-all")
async def delete_all():
    await db.project.deleteMany()
    return {"status": "success"}
