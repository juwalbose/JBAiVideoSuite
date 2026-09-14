from fastapi import APIRouter, Depends
from typing import Any, Optional
from pydantic import BaseModel
from database import get_db
import os

router = APIRouter(prefix="/appsettings", tags=["AppSettings"])

APP_ACTIONS = [
    "Develop Raw Story",
    "Extract Cast",
    "Generate Script",
    "Refine Dialog",
    "Generate Shots",
]

COMFY_ACTIONS = [
    "Asset Generation",
    "Character Sheet Generation",
    "MinimaxH3 Ref2VA Generation",
]

WORKFLOWS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "assets", "workflows")

class MappingUpdate(BaseModel):
    action: str
    promptFile: Optional[str] = None

class WorkflowMappingUpdate(BaseModel):
    action: str
    workflowFile: Optional[str] = None

@router.get("/")
async def get_mappings(db: Any = Depends(get_db)):
    mappings = await db.appactionmapping.find_many()
    result = {}
    for m in mappings:
        result[m.action] = m.promptFile
    # Fill in any actions that have no mapping yet
    for action in APP_ACTIONS:
        if action not in result:
            result[action] = None
    return result

@router.post("/save")
async def save_mapping(update: MappingUpdate, db: Any = Depends(get_db)):
    existing = await db.appactionmapping.find_first(where={'action': update.action})
    if existing:
        await db.appactionmapping.update(
            data={'promptFile': update.promptFile},
            where={'id': existing.id}
        )
    else:
        await db.appactionmapping.create({
            'action': update.action,
            'promptFile': update.promptFile
        })
    return {"status": "success"}

@router.get("/workflows")
async def get_workflow_mappings(db: Any = Depends(get_db)):
    mappings = await db.comfyworkflowmapping.find_many()
    result = {}
    for m in mappings:
        result[m.action] = m.workflowFile
    for action in COMFY_ACTIONS:
        if action not in result:
            result[action] = None
    return result

@router.get("/workflows/files")
async def list_workflow_files():
    if not os.path.isdir(WORKFLOWS_DIR):
        return []
    files = [f for f in os.listdir(WORKFLOWS_DIR) if f.endswith('.json')]
    return sorted(files)

@router.post("/workflows/save")
async def save_workflow_mapping(update: WorkflowMappingUpdate, db: Any = Depends(get_db)):
    existing = await db.comfyworkflowmapping.find_first(where={'action': update.action})
    if existing:
        await db.comfyworkflowmapping.update(
            data={'workflowFile': update.workflowFile},
            where={'id': existing.id}
        )
    else:
        await db.comfyworkflowmapping.create({
            'action': update.action,
            'workflowFile': update.workflowFile
        })
    return {"status": "success"}

DEFAULT_RESOLUTIONS = {
    "character": {"w": 1024, "h": 1024},
    "location": {"w": 1920, "h": 1080},
    "prop": {"w": 1024, "h": 1024},
}

@router.get("/resolutions")
async def get_resolutions(db: Any = Depends(get_db)):
    m = await db.comfyworkflowmapping.find_first(where={'action': 'Asset Generation'})
    if m and m.resolutionJson:
        import json as _json
        try:
            return _json.loads(m.resolutionJson)
        except Exception:
            pass
    return DEFAULT_RESOLUTIONS

@router.post("/resolutions/save")
async def save_resolutions(payload: dict, db: Any = Depends(get_db)):
    import json as _json
    data = _json.dumps(payload)
    existing = await db.comfyworkflowmapping.find_first(where={'action': 'Asset Generation'})
    if existing:
        await db.comfyworkflowmapping.update(
            data={'resolutionJson': data},
            where={'id': existing.id}
        )
    else:
        await db.comfyworkflowmapping.create({
            'action': 'Asset Generation',
            'workflowFile': None,
            'resolutionJson': data
        })
    return {"status": "success"}
