from fastapi import APIRouter, Depends
from typing import Any
from database import get_db
import json
from .llm_helper import get_system_prompt, call_llm

router = APIRouter(prefix="/projects", tags=["Assets"])

@router.post("/{id}/refine-dialog")
async def refine_dialog(id: str, payload: dict, db: Any = Depends(get_db)):
    project = await db.project.find_first(where={'id': id}, include={'script': {}})
    if not project or not project.script:
        return {"status": "error", "details": "Project or Script not found"}
    system_prompt = await get_system_prompt(db, "Refine Dialog")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Refine Dialog'."}
    try:
        script = payload.get('script', project.script.content)
        result = await call_llm(db, system_prompt, f"Refine the dialog in this script:\n\n{script}")
        return {"status": "success", "script": result}
    except Exception as e:
        print(f"DEBUG: Error in refine_dialog: {e}")
        return {"status": "error", "details": str(e)}

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
        asset = await db.asset.create({'projectId': id, 'type': 'PROP', 'name': prop.get('name', ''), 'description': prop.get('description', '')})
        for state in prop.get('states', []):
            await db.assetstate.create({'assetId': asset.id, 'name': state.get('name', ''), 'description': state.get('description', ''), 'prompt': state.get('description', ''), 'scenes': str(state.get('scenes', []))})
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
        entry = {"id": a.id, "name": a.name, "description": a.description or ""}
        entry["states"] = [{"id": s.id, "name": s.name, "description": s.description or "", "prompt": s.prompt or "", "scenes": s.scenes, "imagePath": s.imagePath or "", "characterSheet": s.characterSheet or ""} for s in a.states]
        result["characters" if a.type == "CHARACTER" else "locations" if a.type == "LOCATION" else "props"].append(entry)
    return {"status": "success", "assets": result}

@router.patch("/{id}/assets/{asset_id}")
async def update_asset(id: str, asset_id: str, payload: dict, db: Any = Depends(get_db)):
    try:
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
    except Exception as e:
        print(f"DEBUG: Error in update_asset: {e}")
        return {"status": "error", "details": str(e)}

@router.post("/{id}/assets/{asset_id}/generate-prompt")
async def generate_prompt(id: str, asset_id: str, payload: dict, db: Any = Depends(get_db)):
    asset = await db.asset.find_first(where={'id': asset_id, 'projectId': id})
    if not asset:
        return {"status": "error", "details": "Asset not found"}
    system_prompt = await get_system_prompt(db, "Generate Prompt")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Generate Prompt'."}
    try:
        asset_desc = payload.get('assetDescription', asset.description or '')
        state_desc = payload.get('stateDescription', '')
        prefix = "A full body frontal head to toe image of " if asset.type == "CHARACTER" else ""
        combined = f"{asset_desc}\n\nState: {payload.get('stateName', '')}\n{state_desc}"
        user_content = f"Generate a detailed image prompt for this {asset.type.lower()}:\n\nName: {asset.name}\n{combined}\n\nPrefix the result with: '{prefix}'"
        result = await call_llm(db, system_prompt, user_content)
        return {"status": "success", "prompt": result}
    except Exception as e:
        print(f"DEBUG: Error in generate_prompt: {e}")
        return {"status": "error", "details": str(e)}

@router.delete("/{id}/assets/{asset_id}")
async def delete_asset(id: str, asset_id: str, db: Any = Depends(get_db)):
    """Deletes an asset and all its states."""
    try:
        asset = await db.asset.find_first(where={'id': asset_id, 'projectId': id})
        if not asset:
            return {"status": "error", "details": "Asset not found"}
        await db.assetstate.delete_many(where={'assetId': asset_id})
        await db.asset.delete(where={'id': asset_id})
        return {"status": "success"}
    except Exception as e:
        print(f"DEBUG: Error in delete_asset: {e}")
        return {"status": "error", "details": str(e)}

@router.delete("/{id}/assets/{asset_id}/states/{state_id}")
async def delete_state(id: str, asset_id: str, state_id: str, db: Any = Depends(get_db)):
    """Deletes a specific state. If it's the last state, deletes the asset too."""
    try:
        asset = await db.asset.find_first(where={'id': asset_id, 'projectId': id})
        if not asset:
            return {"status": "error", "details": "Asset not found"}
        states = await db.assetstate.find_many(where={'assetId': asset_id})
        if len(states) <= 1:
            await db.assetstate.delete_many(where={'assetId': asset_id})
            await db.asset.delete(where={'id': asset_id})
        else:
            await db.assetstate.delete(where={'id': state_id})
        return {"status": "success"}
    except Exception as e:
        print(f"DEBUG: Error in delete_state: {e}")
        return {"status": "error", "details": str(e)}

@router.post("/{id}/assets")
async def add_asset(id: str, payload: dict, db: Any = Depends(get_db)):
    """Adds a new asset with its first state, or adds a new state to an existing asset."""
    try:
        asset_type = payload.get('type', '')
        asset_name = payload.get('assetName', '')
        asset_desc = payload.get('assetDescription', '')
        state_name = payload.get('stateName', '')
        state_desc = payload.get('stateDescription', '')
        existing_asset_id = payload.get('existingAssetId')

        if not asset_type or not state_name or not state_desc:
            return {"status": "error", "details": "Missing required fields"}

        if existing_asset_id:
            asset = await db.asset.find_first(where={'id': existing_asset_id, 'projectId': id})
            if not asset:
                return {"status": "error", "details": "Existing asset not found"}
            await db.assetstate.create({'assetId': asset.id, 'name': state_name, 'description': state_desc, 'prompt': state_desc, 'scenes': '[]'})
            return {"status": "success"}
        else:
            if not asset_name:
                return {"status": "error", "details": "Asset name required for new asset"}
            asset = await db.asset.create({'projectId': id, 'type': asset_type, 'name': asset_name, 'description': asset_desc})
            await db.assetstate.create({'assetId': asset.id, 'name': state_name, 'description': state_desc, 'prompt': state_desc, 'scenes': '[]'})
            return {"status": "success"}
    except Exception as e:
        print(f"DEBUG: Error in add_asset: {e}")
        return {"status": "error", "details": str(e)}
