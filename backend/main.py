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
    raw_text: str

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
                status="degraded",
                server_reachable=True,
                active_model="unknown",
                ping_success=False,
                details=f"LM Studio responded with HTTP {models_response.status_code}"
            )

        data = models_response.json()
        model_list = data.get("data", [])

        if not model_list:
            return HandshakeResponse(
                status="warning",
                server_reachable=True,
                active_model="none",
                ping_success=False,
                details="LM Studio is running, but NO model is currently loaded in memory."
            )

        # Retrieve the currently active model ID
        active_model_id = model_list[0].get("id", "unknown")

        # 2. Ping-test generation (1-token completion) to ensure inference works
        ping_payload = {
            "model": active_model_id,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 1,
            "temperature": 0.0,
        }

        chat_response = requests.post(f"{BASE_URL}/chat/completions", json=ping_payload, timeout=10)
        chat_response.raise_for_status()
        
        return HandshakeResponse(
            status="healthy",
            server_reachable=True,
            active_model=active_model_id,
            ping_success=True,
            details="LM Studio is up, model is loaded, and inference responded successfully."
        )

    except requests.exceptions.ConnectTimeout:
        return HandshakeResponse(
            status="unreachable",
            server_reachable=False,
            active_model="unknown",
            ping_success=False,
            details=f"Cannot reach LM Studio at {LM_STUDIO_HOST}:{LM_STUDIO_PORT}. Is the local server started?"
        )
    except Exception as e:
        return HandshakeResponse(
            status="error",
            server_reachable=True,
            active_model="unknown",
            ping_success=False,
            details=f"Unexpected error: {str(e)}"
        )

@app.post("/projects/", response_model=dict)
async def create_project(input_data: ProjectCreate):
    print(f'DEBUG: Creating project named "{input_data.name}"')
    project = await db.project.create(
        data={
            "name": input_data.name,
            "description": input_data.description
        }
    )
    return project.dict()

@app.post("/projects/{project_id}/generate-story", response_model=StoryOutput)
async def generate_story(project_id: str, input_data: StoryInput):
    print(f'DEBUG: Starting generation for Project ID: {project_id}')
    project = await db.project.find_unique(where={"id": project_id})
    if not project:
        print(f'DEBUG: Error - Project {project_id} not found in DB')
        raise HTTPException(status_code=404, detail="Project not found")

    print(f'DEBUG: Raw Input received: "{input_data.raw_text}"')
    prompt = f"""
    Expand the following raw story idea into a detailed Narrative Arc. 
    Focus on setting the scene, establishing the mood, and describing the main conflict.
    
    Raw Idea: {input_data.raw_text}
    
    Narrative Arc:
    """
    
    print(f'DEBUG: Sending prompt to LLM...')
    narrative_arc = call_llm(prompt)
    print(f'DEBUG: Narrative Arc received from LLM.')
    
    story = await db.story.create(
        data={
            "projectId": project_id,
            "narrativeArc": narrative_arc,
            "rawInput": input_data.raw_text
        }
    )
    print(f'DEBUG: Story saved to the database with ID: {story.id}')
    return StoryOutput(
        id=story.id, 
        narrative_arc=story.narrativeArc, 
        raw_input=story.rawInput
    )

@app.post("/projects/{project_id}/generate-script", response_model=dict)
async def generate_script(project_id: str):
    print(f'DEBUG: Starting script generation for Project ID: {project_id}')
    project = await db.project.find_unique(where={"id": project_id})
    if not project or not project.story:
        raise HTTPException(status_code=404, detail="Project with a Story not found")

    # 2. Construct a prompt to break the Narrative Arc into Beats
    prompt = f"""
    Break down the following Narrative Arc into a series of distinct "Beats".
    A Beat is a specific moment of action or mood. 
    Provide 3-5 beats in total.
    
    Narrative Arc: {project.story.narrativeArc}
    
    Format your response as a list of descriptions, one per line.
    Example:
    Beat 1: The robot wakes up and sees the flower for the first time.
    Beat 2: It tries to reach out but its arm is stiff.
    """
    
    raw_beats = call_llm(prompt)
    print(f'DEBUG: Raw beats received from LLM.')
    
    # 3. Parse the raw beats into a list of objects
    beat_list = []
    lines = raw_beats.strip().split('\n')
    for i, line in enumerate(lines):
        if ":" in line:
            content = line.split(":", 1)[1].strip()
            beat_list.append({
                "id": f"beat-{i}",
                "content": content,
                "order": i + 1
            })

    # 4. Save the beats to the database
    for beat in beat_list:
        await db.beat.create(
            data={
                "projectId": project_id,
                "content": beat["content"],
                "order": beat["order"]
            }
        )

    return {"beats": beat_list}

# --- Lifecycle Events ---

@app.on_event("startup")
async def startup():
    await db.connect()

@app.on_event("shutdown")
async def shutdown():
    await db.disconnect()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
