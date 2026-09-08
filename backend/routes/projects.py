from fastapi import APIRouter, Depends
from typing import Optional, Any
from database import get_db
from models import ProjectCreate, StoryInput
import requests

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("/")
async def list_projects(db: Any = Depends(get_db)):
    try:
        projects = await db.project.find_many(include={'story': {}})
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
        'description': project.description
    })
    
    # Automatically create an initial story for this project
    await db.story.create({
        'projectId': new_project.id,
        'rawInput': '',
        'narrativeArc': ''
    })
    
    # Fetch the updated project with its story included
    updated_project = await db.project.find_first(where={'id': new_project.id}, include={'story': {}})
    return updated_project.dict()

@router.patch("/{id}")
async def update_project(id: str, name: str, db: Any = Depends(get_db), description: Optional[str] = None):
    updated_project = await db.project.update({
        'where': {'id': id},
        'data': {
            'name': name,
            'description': description
        }
    })
    return updated_project.dict()

@router.post("/{id}/generate-story")
async def generate_story(id: str, story_input: StoryInput, db: Any = Depends(get_db)):
    # 1. Fetch the project and its story
    project = await db.project.find_first(where={'id': id}, include={'story': {}})
    if not project or not project.story:
        return {"status": "error", "details": "Project or Story not found"}

    # 2. Call the LLM using our dynamic settings
    llm = await db.llmsettings.find_first()
    ip, port, modelName, temperature = llm.ip, llm.port, llm.modelName, llm.temperature
    
    url = f"http://{ip}:{port}/v1/chat/completions"
    payload = {
        "model": modelName, 
        "messages": [
            {"role": "system", "content": "You are a creative video production assistant. Your task is to turn a raw story idea into a structured Narrative Arc."},
            {"role": "user", "content": f"Turn this raw idea into a narrative arc: {story_input.rawInput}"}
        ],
        "temperature": temperature,
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        
        # 3. Update the story in the database
        await db.story.update({
            'where': {'projectId': id},
            'data': {
                'rawInput': story_input.rawInput,
                'narrativeArc': result
            }
        })

        return {"status": "success", "narrative_arc": result}
    except Exception as e:
        print(f"DEBUG: Error in generate_story: {e}")
        return {"status": "error", "details": str(e)}

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
