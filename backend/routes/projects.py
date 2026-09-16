from fastapi import APIRouter, Depends
from typing import Optional, Any
from database import get_db
from models import ProjectCreate, StoryInput
import httpx
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
        projects = await db.project.find_many(include={'stories': True, 'scripts': True})
        result = []
        for p in projects:
            d = p.dict()
            # Flatten episode-1 story/script into the shape the frontend expects
            stories = d.pop('stories', [])
            scripts = d.pop('scripts', [])
            d['story'] = stories[0] if stories else None
            d['script'] = scripts[0] if scripts else None
            result.append(d)
        return result
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
    
    # Automatically create an initial story for this project (episode 1)
    await db.story.create({
        'projectId': new_project.id,
        'episode': 1,
        'rawInput': '',
        'narrativeArc': ''
    })
    
    # Fetch the updated project
    updated_project = await db.project.find_first(where={'id': new_project.id}, include={'stories': True, 'scripts': True})
    d = updated_project.dict()
    stories = d.pop('stories', [])
    scripts = d.pop('scripts', [])
    d['story'] = stories[0] if stories else None
    d['script'] = scripts[0] if scripts else None
    return d

@router.delete("/{id}")
async def delete_project(id: str, db: Any = Depends(get_db)):
    # Delete child records in order to satisfy foreign key constraints
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}

    # Find and delete shots, assets, beats, story, shotlist, audio, finalvideo for this project
    beats = await db.beat.find_many(where={'projectId': id})
    beat_ids = [b.id for b in beats]
    if beat_ids:
        await db.shot.delete_many(where={'beatId': {'in': beat_ids}})
    await db.shotlist.delete_many(where={'projectId': id})
    await db.audioasset.delete_many(where={'projectId': id})
    await db.asset.delete_many(where={'projectId': id})
    await db.beat.delete_many(where={'projectId': id})
    await db.story.delete_many(where={'projectId': id})
    await db.script.delete_many(where={'projectId': id})
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
        data=data,
        include={'stories': True, 'scripts': True}
    )
    d = updated_project.dict()
    stories = d.pop('stories', [])
    scripts = d.pop('scripts', [])
    d['story'] = stories[0] if stories else None
    d['script'] = scripts[0] if scripts else None
    return d

@router.post("/{id}/generate-story")
async def generate_story(id: str, story_input: StoryInput, episode: int = 1, db: Any = Depends(get_db)):
    # 1. Fetch the project and its story for this episode
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}
    story = await db.story.find_first(where={'projectId': id, 'episode': episode})
    if not story:
        return {"status": "error", "details": f"Story not found for episode {episode}"}

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

    timeout = httpx.Timeout(300.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            result = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")

            return {"status": "success", "narrative_arc": result}
    except Exception as e:
        print(f"DEBUG: Error in generate_story: {e}")
        return {"status": "error", "details": str(e)}

@router.post("/{id}/generate-script")
async def generate_script(id: str, episode: int = 1, db: Any = Depends(get_db)):
    # 1. Fetch the project and its story for this episode
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}
    story = await db.story.find_first(where={'projectId': id, 'episode': episode})
    if not story:
        return {"status": "error", "details": f"Story not found for episode {episode}"}

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
            {"role": "user", "content": f"Duration: {project.duration} seconds. Turn this narrative arc into a detailed script:\n\n{story.narrativeArc}"}
        ],
        "temperature": temperature,
    }

    timeout = httpx.Timeout(300.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            result = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")

            return {"status": "success", "script": result}
    except Exception as e:
        print(f"DEBUG: Error in generate_script: {e}")
        return {"status": "error", "details": str(e)}

@router.post("/{id}/generate-shots")
async def generate_shots(id: str, episode: int = 1, db: Any = Depends(get_db)):
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}
    script = await db.script.find_first(where={'projectId': id, 'episode': episode})
    if not script:
        return {"status": "error", "details": f"Script not found for episode {episode}"}
    system_prompt = await get_system_prompt(db, "Generate Shots")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Generate Shots'. Go to Settings > App Settings and map a prompt first."}
    llm = await db.llmsettings.find_first()
    ip, port, modelName, temperature = llm.ip, llm.port, llm.modelName, llm.temperature
    url = f"http://{ip}:{port}/v1/chat/completions"
    payload = {
        "model": modelName,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Split this script into shots for MiniMax H3 video model:\n\n{script.content}"}
        ],
        "temperature": temperature,
        "max_tokens": 16384,
    }
    timeout = httpx.Timeout(300.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            result = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            finish_reason = data.get("choices", [{}])[0].get("finish_reason", "unknown")
            print(f"DEBUG: generate_shots response length={len(result)}, finish_reason={finish_reason}")
            return {"status": "success", "shots": result}
    except Exception as e:
        print(f"DEBUG: Error in generate_shots: {e}")
        return {"status": "error", "details": str(e)}

@router.patch("/{id}/script")
async def update_script(id: str, payload: dict, episode: int = 1, db: Any = Depends(get_db)):
    # 1. Fetch the project
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}

    content = payload.get('content', '')

    # 2. Upsert the script for this episode
    existing = await db.script.find_first(where={'projectId': id, 'episode': episode})
    if existing:
        await db.script.update(
            where={'id': existing.id},
            data={'content': content}
        )
    else:
        await db.script.create({
            'projectId': id,
            'episode': episode,
            'content': content
        })

    return {"status": "success"}

@router.patch("/{id}/story")
async def update_story(id: str, story_input: StoryInput, episode: int = 1, db: Any = Depends(get_db)):
    # 1. Fetch the project and its story for this episode
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}
    story = await db.story.find_first(where={'projectId': id, 'episode': episode})
    if not story:
        return {"status": "error", "details": f"Story not found for episode {episode}"}

    # 2. Update the story in the database
    await db.story.update(
        data={
            'rawInput': story_input.rawInput,
            'narrativeArc': story_input.narrativeArc if story_input.narrativeArc is not None else ""
        },
        where={'id': story.id}
    )

    return {"status": "success", "data": story_input}
