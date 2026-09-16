from fastapi import APIRouter, Depends
from typing import Any, Optional
from pydantic import BaseModel
from database import get_db
from paths import WORKFLOWS_DIR
import os

def _safe_filename(filename: Optional[str]) -> Optional[str]:
    """Sanitize a filename: basename only, must end with .txt or .json."""
    if not filename:
        return None
    base = os.path.basename(filename)
    if base != filename or "/" in base or "\\" in base or base.startswith("."):
        return None
    if not (base.endswith(".txt") or base.endswith(".json")):
        return None
    return base

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
    "MinimaxH3 Ref2VA High Res Generation",
]

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
    # M8: sanitize promptFile
    safe_file = _safe_filename(update.promptFile)
    if update.promptFile and safe_file is None:
        return {"status": "error", "details": f"Invalid prompt file: {update.promptFile}"}
    existing = await db.appactionmapping.find_first(where={'action': update.action})
    if existing:
        await db.appactionmapping.update(
            data={'promptFile': safe_file},
            where={'id': existing.id}
        )
    else:
        await db.appactionmapping.create({
            'action': update.action,
            'promptFile': safe_file
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
    # M8: sanitize workflowFile
    safe_file = _safe_filename(update.workflowFile)
    if update.workflowFile and safe_file is None:
        return {"status": "error", "details": f"Invalid workflow file: {update.workflowFile}"}
    existing = await db.comfyworkflowmapping.find_first(where={'action': update.action})
    if existing:
        await db.comfyworkflowmapping.update(
            data={'workflowFile': safe_file},
            where={'id': existing.id}
        )
    else:
        await db.comfyworkflowmapping.create({
            'action': update.action,
            'workflowFile': safe_file
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
        try:
            await db.comfyworkflowmapping.create({
                'action': 'Asset Generation',
                'workflowFile': None,
                'resolutionJson': data
            })
        except Exception:
            existing = await db.comfyworkflowmapping.find_first(where={'action': 'Asset Generation'})
            if existing:
                await db.comfyworkflowmapping.update(
                    data={'resolutionJson': data},
                    where={'id': existing.id}
                )
    return {"status": "success"}

DEFAULT_VIDEO_RESOLUTIONS = {
    "w": 960,
    "h": 544,
}

@router.get("/video-resolutions")
async def get_video_resolutions(db: Any = Depends(get_db)):
    m = await db.comfyworkflowmapping.find_first(where={'action': 'MinimaxH3 Ref2VA Generation'})
    if m and m.resolutionJson:
        import json as _json
        try:
            return _json.loads(m.resolutionJson)
        except Exception:
            pass
    return DEFAULT_VIDEO_RESOLUTIONS

@router.post("/video-resolutions/save")
async def save_video_resolutions(payload: dict, db: Any = Depends(get_db)):
    import json as _json
    data = _json.dumps(payload)
    existing = await db.comfyworkflowmapping.find_first(where={'action': 'MinimaxH3 Ref2VA Generation'})
    if existing:
        await db.comfyworkflowmapping.update(
            data={'resolutionJson': data},
            where={'id': existing.id}
        )
    else:
        try:
            await db.comfyworkflowmapping.create({
                'action': 'MinimaxH3 Ref2VA Generation',
                'workflowFile': None,
                'resolutionJson': data
            })
        except Exception:
            existing = await db.comfyworkflowmapping.find_first(where={'action': 'MinimaxH3 Ref2VA Generation'})
            if existing:
                await db.comfyworkflowmapping.update(
                    data={'resolutionJson': data},
                    where={'id': existing.id}
                )
    return {"status": "success"}

DEFAULT_UPSCALE_VALUE = 2

@router.get("/upscale-value")
async def get_upscale_value(db: Any = Depends(get_db)):
    m = await db.comfyworkflowmapping.find_first(where={'action': 'MinimaxH3 Ref2VA High Res Generation'})
    if m and m.resolutionJson:
        import json as _json
        try:
            data = _json.loads(m.resolutionJson)
            if isinstance(data, dict) and 'upscaleValue' in data:
                return data
        except Exception:
            pass
    return {"upscaleValue": DEFAULT_UPSCALE_VALUE}

@router.post("/upscale-value/save")
async def save_upscale_value(payload: dict, db: Any = Depends(get_db)):
    import json as _json
    data = _json.dumps(payload)
    existing = await db.comfyworkflowmapping.find_first(where={'action': 'MinimaxH3 Ref2VA High Res Generation'})
    if existing:
        await db.comfyworkflowmapping.update(
            data={'resolutionJson': data},
            where={'id': existing.id}
        )
    else:
        try:
            await db.comfyworkflowmapping.create({
                'action': 'MinimaxH3 Ref2VA High Res Generation',
                'workflowFile': None,
                'resolutionJson': data
            })
        except Exception:
            existing = await db.comfyworkflowmapping.find_first(where={'action': 'MinimaxH3 Ref2VA High Res Generation'})
            if existing:
                await db.comfyworkflowmapping.update(
                    data={'resolutionJson': data},
                    where={'id': existing.id}
                )
    return {"status": "success"}
