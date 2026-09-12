from fastapi import APIRouter, Depends
from typing import Any
from database import get_db
import requests
import os
import json

router = APIRouter(prefix="/projects", tags=["Assets"])

PROMPTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "systemprompts"))

async def get_system_prompt(db, action: str):
    mapping = await db.appactionmapping.find_first(where={'action': action})
    if not mapping or not mapping.promptFile:
        return None
    filepath = os.path.join(PROMPTS_DIR, mapping.promptFile)
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

@router.post("/{id}/extract-cast")
async def extract_cast(id: str, db: Any = Depends(get_db)):
    project = await db.project.find_first(where={'id': id}, include={'script': {}})
    if not project or not project.script:
        return {"status": "error", "details": "Project or Script not found"}

    system_prompt = await get_system_prompt(db, "Extract Cast")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Extract Cast'. Go to Settings > App Settings and map a prompt first."}

    llm = await db.llmsettings.find_first()
    ip, port, modelName, temperature = llm.ip, llm.port, llm.modelName, llm.temperature

    url = f"http://{ip}:{port}/v1/chat/completions"
    payload = {
        "model": modelName,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract all characters, environments, and props from this script:\n\n{project.script.content}"}
        ],
        "temperature": temperature,
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
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
        asset = await db.asset.create({
            'projectId': id, 'type': 'CHARACTER',
            'name': char.get('name', ''), 'description': char.get('description', '')
        })
        for state in char.get('states', []):
            await db.assetstate.create({
                'assetId': asset.id, 'name': state.get('name', ''),
                'description': state.get('description', ''),
                'prompt': state.get('description', ''),
                'scenes': str(state.get('scenes', []))
            })
        created += 1

    for loc in data.get('locations', []):
        asset = await db.asset.create({
            'projectId': id, 'type': 'LOCATION',
            'name': loc.get('name', ''), 'description': loc.get('description', '')
        })
        for state in loc.get('states', []):
            await db.assetstate.create({
                'assetId': asset.id, 'name': state.get('name', ''),
                'description': state.get('description', ''),
                'prompt': state.get('description', ''),
                'scenes': str(state.get('scenes', []))
            })
        created += 1

    for prop in data.get('props', []):
        asset = await db.asset.create({
            'projectId': id, 'type': 'PROP',
            'name': prop.get('name', ''), 'description': prop.get('description', '')
        })
        created += 1

    return {"status": "success", "assetsCreated": created}

@router.get("/{id}/assets")
async def get_assets(id: str, db: Any = Depends(get_db)):
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}

    assets = await db.asset.find_many(
        where={'projectId': id},
        include={'states': {}}
    )

    result = {"characters": [], "locations": [], "props": []}
    for a in assets:
        entry = {
            "name": a.name,
            "description": a.description or ""
        }
        if a.type == "CHARACTER":
            entry["states"] = [
                {"name": s.name, "description": s.description or "", "scenes": s.scenes}
                for s in a.states
            ]
            result["characters"].append(entry)
        elif a.type == "LOCATION":
            entry["states"] = [
                {"name": s.name, "description": s.description or "", "scenes": s.scenes}
                for s in a.states
            ]
            result["locations"].append(entry)
        elif a.type == "PROP":
            entry["scenes"] = a.states[0].scenes if a.states else None
            result["props"].append(entry)

    return {"status": "success", "assets": result}
