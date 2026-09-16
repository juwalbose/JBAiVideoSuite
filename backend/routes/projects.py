from fastapi import APIRouter, Depends
from typing import Optional, Any
from database import get_db
from models import ProjectCreate, StoryInput
from .llm_helper import get_system_prompt, call_llm

router = APIRouter(prefix="/projects", tags=["Projects"])

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
        return {"status": "error", "details": str(e)}

@router.post("/delete-all")
async def delete_all(db: Any = Depends(get_db)):
    async with db.tx() as tx:
        await tx.assetstate.delete_many()
        await tx.shot.delete_many()
        await tx.shotlist.delete_many()
        await tx.audioasset.delete_many()
        await tx.asset.delete_many()
        await tx.finalvideo.delete_many()
        await tx.script.delete_many()
        await tx.story.delete_many()
        await tx.beat.delete_many()
        await tx.project.delete_many()
    return {"status": "success"}

@router.delete("/delete-all")
async def delete_all(db: Any = Depends(get_db)):
    async with db.tx() as tx:
        await tx.assetstate.delete_many()
        await tx.shot.delete_many()
        await tx.shotlist.delete_many()
        await tx.audioasset.delete_many()
        await tx.asset.delete_many()
        await tx.finalvideo.delete_many()
        await tx.script.delete_many()
        await tx.story.delete_many()
        await tx.beat.delete_many()
        await tx.project.delete_many()
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
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}

    async with db.tx() as tx:
        await tx.assetstate.delete_many(where={'asset': {'projectId': id}})
        await tx.shot.delete_many(where={'beat': {'projectId': id}})
        await tx.shotlist.delete_many(where={'projectId': id})
        await tx.audioasset.delete_many(where={'projectId': id})
        await tx.asset.delete_many(where={'projectId': id})
        await tx.finalvideo.delete_many(where={'projectId': id})
        await tx.script.delete_many(where={'projectId': id})
        await tx.story.delete_many(where={'projectId': id})
        await tx.beat.delete_many(where={'projectId': id})
        await tx.project.delete(where={'id': id})

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
        story = await db.story.create({
            'projectId': id,
            'episode': episode,
            'rawInput': '',
            'narrativeArc': ''
        })

    # 2. Check for mapped system prompt
    system_prompt = await get_system_prompt(db, "Develop Raw Story")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Develop Raw Story'. Go to Settings > App Settings and map a prompt first."}

    # 3. Call the LLM
    try:
        result = await call_llm(db, system_prompt, f"Duration: {project.duration} seconds. Turn this raw idea into a narrative arc: {story_input.rawInput}")
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

    # 3. Call the LLM
    try:
        result = await call_llm(db, system_prompt, f"Duration: {project.duration} seconds. Turn this narrative arc into a detailed script:\n\n{story.narrativeArc}")
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
    try:
        result = await call_llm(db, system_prompt, f"Split this script into shots for MiniMax H3 video model:\n\n{script.content}")
        print(f"DEBUG: generate_shots response length={len(result)}")
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
    if story:
        await db.story.update(
            data={
                'rawInput': story_input.rawInput,
                'narrativeArc': story_input.narrativeArc if story_input.narrativeArc is not None else ""
            },
            where={'id': story.id}
        )
    else:
        await db.story.create({
            'projectId': id,
            'episode': episode,
            'rawInput': story_input.rawInput,
            'narrativeArc': story_input.narrativeArc if story_input.narrativeArc is not None else ""
        })

    return {"status": "success", "data": story_input}
