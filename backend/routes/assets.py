from fastapi import APIRouter, Depends
from typing import Any
from database import get_db
import json
from .llm_helper import get_system_prompt, call_llm

router = APIRouter(prefix="/projects", tags=["Assets"])

@router.post("/{id}/extract-cast")
async def extract_cast(id: str, db: Any = Depends(get_db)):
    project = await db.project.find_first(where={'id': id}, include={'script': {}})
    if not project or not project.script:
        return {"status": "error", "details": "Project or Script not found"}
    system_prompt = await get_system_prompt(db, "Extract Cast")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Extract Cast'."}
    try:
        result = await call_llm(db, system_prompt, f"Extract all characters, environments, and props from this script:\n\n{project.script.content}")
        return {"status": "success", "cast": result}
    except Exception as e:
        print(f"DEBUG: Error in extract_cast: {e}")
        return {"status": "error", "details": str(e)}

@router.post("/{id}/save-assets")
async def save_assets(id: str, payload: dict, db: Any = Depends(get_db)):
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}
    raw = payload.get('cast', '')
    if not raw:
        return {"status": "error", "details": "No cast data provided"}
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        data = json.loads(text)
    except Exception as e:
        return {"status": "error", "details": f"Failed to parse JSON: {str(e)}"}
    existing_assets = await db.asset.find_many(where={'projectId': id})
    for asset in existing_assets:
        await db.assetstate.delete_many(where={'assetId': asset.id})
    await db.asset.delete_many(where={'projectId': id})
    created = 0
    for char in data.get('characters', []):
        asset = await db.asset.create({'projectId': id, 'type': 'CHARACTER', 'name': char.get('name', ''), 'description': char.get('description', '')})
        for state in char.get('states', []):
            await db.assetstate.create({'assetId': asset.id, 'name': state.get('name', ''), 'description': state.get('description', ''), 'prompt': state.get('description', ''), 'scenes': str(state.get('scenes', []))})
        created += 1
    for loc in data.get('locations', []):
        asset = await db.asset.create({'projectId': id, 'type': 'LOCATION', 'name': loc.get('name', ''), 'description': loc.get('description', '')})
        for state in loc.get('states', []):
            await db.assetstate.create({'assetId': asset.id, 'name': state.get('name', ''), 'description': state.get('description', ''), 'prompt': state.get('description', ''), 'scenes': str(state.get('scenes', []))})
        created += 1
    for prop in data.get('props', []):
        await db.asset.create({'projectId': id, 'type': 'PROP', 'name': prop.get('name', ''), 'description': prop.get('description', '')})
        created += 1
    return {"status": "success", "assetsCreated": created}

@router.get("/{id}/assets")
async def get_assets(id: str, db: Any = Depends(get_db)):
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}
    assets = await db.asset.find_many(where={'projectId': id}, include={'states': {}})
    result = {"characters": [], "locations": [], "props": []}
    for a in assets:
        entry = {"name": a.name, "description": a.description or ""}
        if a.type in ("CHARACTER", "LOCATION"):
            entry["states"] = [{"name": s.name, "description": s.description or "", "prompt": s.prompt or "", "scenes": s.scenes, "imagePath": s.imagePath or "", "characterSheet": s.characterSheet or ""} for s in a.states]
            result["characters" if a.type == "CHARACTER" else "locations"].append(entry)
        elif a.type == "PROP":
            entry["scenes"] = a.states[0].scenes if a.states else None
            result["props"].append(entry)
    return {"status": "success", "assets": result}

@router.patch("/{id}/assets/{asset_id}")
async def update_asset(id: str, asset_id: str, payload: dict, db: Any = Depends(get_db)):
    asset = await db.asset.find_first(where={'id': asset_id, 'projectId': id})
    if not asset:
        return {"status": "error", "details": "Asset not found"}
    data = {}
    if 'name' in payload:
        data['name'] = payload['name']
    if 'description' in payload:
        data['description'] = payload['description']
    if data:
        await db.asset.update(where={'id': asset_id}, data=data)
    if 'states' in payload:
        existing_states = await db.assetstate.find_many(where={'assetId': asset_id})
        for i, state_data in enumerate(payload['states']):
            if i < len(existing_states):
                s = existing_states[i]
                sdata = {k: state_data[k] for k in ('name', 'description', 'prompt', 'imagePath', 'characterSheet') if k in state_data}
                if 'scenes' in state_data:
                    sdata['scenes'] = str(state_data['scenes'])
                if sdata:
                    await db.assetstate.update(where={'id': s.id}, data=sdata)
            else:
                await db.assetstate.create({'assetId': asset_id, 'name': state_data.get('name', ''), 'description': state_data.get('description', ''), 'prompt': state_data.get('prompt', ''), 'scenes': str(state_data.get('scenes', []))})
    return {"status": "success"}

@router.post("/{id}/assets/{asset_id}/generate-prompt")
async def generate_prompt(id: str, asset_id: str, payload: dict, db: Any = Depends(get_db)):
    asset = await db.asset.find_first(where={'id': asset_id, 'projectId': id})
    if not asset:
        return {"status": "error", "details": "Asset not found"}
    system_prompt = await get_system_prompt(db, "Generate Prompt")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Generate Prompt'."}
    try:
        user_content = f"Generate a detailed image prompt for this {asset.type.lower()}:\n\nName: {asset.name}\nState: {payload.get('stateName', '')}\nDescription: {payload.get('description', '')}"
        result = await call_llm(db, system_prompt, user_content)
        return {"status": "success", "prompt": result}
    except Exception as e:
        print(f"DEBUG: Error in generate_prompt: {e}")
        return {"status": "error", "details": str(e)}
