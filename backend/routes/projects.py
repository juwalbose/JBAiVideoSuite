from fastapi import APIRouter, Depends
from typing import Optional, Any
from database import get_db
from models import ProjectCreate, StoryInput
import requests
import os

router = APIRouter(prefix="/projects", tags=["Projects"])

PROMPTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "systemprompts"))

async def get_system_prompt(db, action: str) -> Optional[str]:
    """Fetch the mapped system prompt file content for an action, or None."""
    mapping = await db.appactionmapping.find_first(where={'action': action})
    if not mapping or not mapping.promptFile:
        return None
    filepath = os.path.join(PROMPTS_DIR, mapping.promptFile)
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

@router.get("/")
async def list_projects(db: Any = Depends(get_db)):
    try:
        projects = await db.project.find_many(include={'story': {}, 'script': {}})
        return [p.dict() for p in projects]
    except Exception as e:
        print(f"DEBUG: Error fetching projects: {e}")
        return []

@router.post("/delete-all")
async def delete_all(db: Any = Depends(get_db)):
    # Delete in order to satisfy foreign key constraints (Bottom-Up)
    await db.finalvideo.delete_many()
    await db.shot.delete_many()
    await db.asset.delete_many()
    await db.story.delete_many()
    await db.beat.delete_many()
    await db.project.delete_many()
    return {"status": "success"}

@router.delete("/delete-all")
async def delete_all(db: Any = Depends(get_db)):
    # Delete in order to satisfy foreign key constraints (Bottom-Up)
    await db.finalvideo.delete_many()
    await db.shot.delete_many()
    await db.asset.delete_many()
    await db.story.delete_many()
    await db.beat.delete_many()
    await db.project.delete_many()
    
    # Physically shrink the database file and clean up empty space
    await db.execute_raw("VACUUM;")
    return {"status": "success"}

@router.post("/")
async def create_project(project: ProjectCreate, db: Any = Depends(get_db)):
    # Create the project first
    new_project = await db.project.create({
        'name': project.name,
        'type': project.type
    })
    
    # Automatically create an initial story for this project
    await db.story.create({
        'projectId': new_project.id,
        'rawInput': '',
        'narrativeArc': ''
    })
    
    # Fetch the updated project with its story and script included
    updated_project = await db.project.find_first(where={'id': new_project.id}, include={'story': {}, 'script': {}})
    return updated_project.dict()

@router.delete("/{id}")
async def delete_project(id: str, db: Any = Depends(get_db)):
    # Delete child records in order to satisfy foreign key constraints
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}

    # Find and delete shots, assets, beats, story, finalvideo for this project
    beats = await db.beat.find_many(where={'projectId': id})
    beat_ids = [b.id for b in beats]
    if beat_ids:
        await db.shot.delete_many(where={'beatId': {'in': beat_ids}})
    await db.asset.delete_many(where={'projectId': id})
    await db.beat.delete_many(where={'projectId': id})
    await db.story.delete_many(where={'projectId': id})
    await db.finalvideo.delete_many(where={'projectId': id})
    await db.project.delete(where={'id': id})

    return {"status": "success"}

@router.patch("/{id}")
async def update_project(id: str, payload: dict, db: Any = Depends(get_db)):
    data: dict = {}
    if 'name' in payload:
        data['name'] = payload['name']
    if 'duration' in payload and payload['duration'] is not None:
        data['duration'] = payload['duration']
    if 'episodeCount' in payload and payload['episodeCount'] is not None:
        data['episodeCount'] = payload['episodeCount']
    if not data:
        return {"status": "error", "details": "No fields to update"}
    updated_project = await db.project.update(
        where={'id': id},
        data=data
    )
    return updated_project.dict()

@router.post("/{id}/generate-story")
async def generate_story(id: str, story_input: StoryInput, db: Any = Depends(get_db)):
    # 1. Fetch the project and its story
    project = await db.project.find_first(where={'id': id}, include={'story': {}})
    if not project or not project.story:
        return {"status": "error", "details": "Project or Story not found"}

    # 2. Check for mapped system prompt
    system_prompt = await get_system_prompt(db, "Develop Raw Story")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Develop Raw Story'. Go to Settings > App Settings and map a prompt first."}

    # 3. Call the LLM using our dynamic settings
    llm = await db.llmsettings.find_first()
    ip, port, modelName, temperature = llm.ip, llm.port, llm.modelName, llm.temperature

    url = f"http://{ip}:{port}/v1/chat/completions"
    payload = {
        "model": modelName,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Duration: {project.duration} seconds. Turn this raw idea into a narrative arc: {story_input.rawInput}"}
        ],
        "temperature": temperature,
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")

        return {"status": "success", "narrative_arc": result}
    except Exception as e:
        print(f"DEBUG: Error in generate_story: {e}")
        return {"status": "error", "details": str(e)}

@router.post("/{id}/generate-script")
async def generate_script(id: str, db: Any = Depends(get_db)):
    # 1. Fetch the project and its story
    project = await db.project.find_first(where={'id': id}, include={'story': {}})
    if not project or not project.story:
        return {"status": "error", "details": "Project or Story not found"}

    # 2. Check for mapped system prompt
    system_prompt = await get_system_prompt(db, "Generate Script")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Generate Script'. Go to Settings > App Settings and map a prompt first."}

    # 3. Call the LLM using our dynamic settings
    llm = await db.llmsettings.find_first()
    ip, port, modelName, temperature = llm.ip, llm.port, llm.modelName, llm.temperature

    url = f"http://{ip}:{port}/v1/chat/completions"
    payload = {
        "model": modelName,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Duration: {project.duration} seconds. Turn this narrative arc into a detailed script:\n\n{project.story.narrativeArc}"}
        ],
        "temperature": temperature,
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")

        return {"status": "success", "script": result}
    except Exception as e:
        print(f"DEBUG: Error in generate_script: {e}")
        return {"status": "error", "details": str(e)}

@router.patch("/{id}/script")
async def update_script(id: str, payload: dict, db: Any = Depends(get_db)):
    # 1. Fetch the project
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}

    content = payload.get('content', '')

    # 2. Upsert the script
    existing = await db.script.find_first(where={'projectId': id})
    if existing:
        await db.script.update(
            where={'id': existing.id},
            data={'content': content}
        )
    else:
        await db.script.create({
            'projectId': id,
            'content': content
        })

    return {"status": "success"}

@router.patch("/{id}/story")
async def update_story(id: str, story_input: StoryInput, db: Any = Depends(get_db)):
    # 1. Fetch the project and its story
    project = await db.project.find_first(where={'id': id}, include={'story': {}})
    if not project or not project.story:
        return {"status": "error", "details": "Project or Story not found"}

    # 2. Update the story in the database
    await db.story.update(
        data={
            'rawInput': story_input.rawInput,
            'narrativeArc': story_input.narrativeArc if story_input.narrativeArc is not None else ""
        },
        where={'projectId': id}
    )

    return {"status": "success", "data": story_input}
