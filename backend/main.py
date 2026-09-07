from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import requests
import json
import asyncio

# Import Prisma (We will assume prisma-client-python is installed)
from prisma import Prisma

db = Prisma()

app = FastAPI(title="BionicProducer API")

# --- Models ---

class StoryInput(BaseModel):
    raw_text: str

class StoryOutput(BaseModel):
    id: str
    narrative_arc: str
    raw_input: Optional[str]

# --- Helper Functions ---

def call_ollama(prompt: str) -> str:
    """Helper to call Ollama's local LLM."""
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": "llama3", # Change this to your preferred model in LM Studio / Ollama
        "prompt": prompt,
        "stream": False
    }
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json().get("response", "")
    except Exception as e:
        # Fallback for when Ollama isn't running yet
        return f"Ollama is not reachable. Error: {str(e)}"

# --- Endpoints ---

@app.post("/projects/", response_model=dict)
def create_project(name: str, description: Optional[str] = None):
    # Create a new project in the database
    project = db.project.create(
        data={
            "name": name,
            "description": description
        }
    )
    return project

@app.post("/projects/{project_id}/generate-story", response_model=StoryOutput)
def generate_story(project_id: str, input_data: StoryInput):
    # 1. Get the project from DB
    project = db.project.find_unique(where={"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2. Construct a prompt for the LLM to expand raw text into a narrative arc
    prompt = f"""
    Expand the following raw story idea into a detailed Narrative Arc. 
    Focus on setting the scene, establishing the mood, and describing the main conflict.
    
    Raw Idea: {input_data.raw_text}
    
    Narrative Arc:
    """
    
    narrative_arc = call_ollama(prompt)
    
    # 3. Save the story to the database
    story = db.story.create(
        data={
            "projectId": project_id,
            "narrativeArc": narrative_arc,
            "rawInput": input_data.raw_text
        }
    )
    
    return StoryOutput(
        id=story.id, 
        narrative_arc=story.narrativeArc, 
        raw_input=story.rawInput
    )

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
