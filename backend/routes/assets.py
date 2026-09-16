from fastapi import APIRouter, Depends
from typing import Any
from database import get_db
from paths import WORKFLOWS_DIR, GENERATED_DIR
import json
import os
import uuid
import random
import httpx
from .llm_helper import get_system_prompt, call_llm

router = APIRouter(prefix="/projects", tags=["Assets"])

# Separate task tracker for asset image generation (independent from playground)
asset_gen_tasks: dict = {}

DEFAULT_RESOLUTIONS = {
    "character": {"w": 1024, "h": 1024},
    "location": {"w": 1920, "h": 1080},
    "prop": {"w": 1024, "h": 1024},
}

@router.post("/{id}/refine-dialog")
async def refine_dialog(id: str, payload: dict, episode: int = 1, db: Any = Depends(get_db)):
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}
    script = await db.script.find_first(where={'projectId': id, 'episode': episode})
    if not script:
        return {"status": "error", "details": f"Script not found for episode {episode}"}
    system_prompt = await get_system_prompt(db, "Refine Dialog")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Refine Dialog'."}
    try:
        script_content = payload.get('script', script.content)

        # Fetch character assets with their characteristics
        characters = await db.asset.find_many(
            where={'projectId': id, 'episode': episode, 'type': 'CHARACTER'}
        )
        char_context = ""
        if characters:
            char_lines = []
            for c in characters:
                line = f"  {c.name}"
                if c.characteristics:
                    line += f" — {c.characteristics}"
                elif c.description:
                    line += f" — {c.description}"
                char_lines.append(line)
            char_context = "\n\nCharacter characteristics:\n" + "\n".join(char_lines)

        result = await call_llm(db, system_prompt, f"Refine the dialog in this script:{char_context}\n\n{script_content}")
        return {"status": "success", "script": result}
    except Exception as e:
        print(f"DEBUG: Error in refine_dialog: {e}")
        return {"status": "error", "details": str(e)}

@router.post("/{id}/extract-cast")
async def extract_cast(id: str, payload: dict = None, episode: int = 1, db: Any = Depends(get_db)):
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}
    # Use the script from the request body if provided (unsaved local edits), otherwise fall back to DB
    script_content = (payload or {}).get('script', '')
    if not script_content:
        script = await db.script.find_first(where={'projectId': id, 'episode': episode})
        if not script:
            return {"status": "error", "details": f"Script not found for episode {episode}"}
        script_content = script.content
    system_prompt = await get_system_prompt(db, "Extract Cast")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Extract Cast'."}
    try:
        result = await call_llm(db, system_prompt, f"Extract all characters, environments, and props from this script:\n\n{script_content}")
        return {"status": "success", "cast": result}
    except Exception as e:
        print(f"DEBUG: Error in extract_cast: {e}")
        return {"status": "error", "details": str(e)}

@router.post("/{id}/save-assets")
async def save_assets(id: str, payload: dict, episode: int = 1, db: Any = Depends(get_db)):
    """Upsert assets keyed by (type, name, episode). Preserves existing IDs, images, sheets."""
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

    # Validate structure before any DB writes
    for key in ('characters', 'locations', 'props'):
        if key in data and not isinstance(data[key], list):
            return {"status": "error", "details": f"'{key}' must be a list"}

    created = 0
    updated = 0

    async with db.tx() as tx:
        for asset_type, key in [('CHARACTER', 'characters'), ('LOCATION', 'locations'), ('PROP', 'props')]:
            for item in data.get(key, []):
                name = item.get('name', '')
                if not name:
                    continue
                description = item.get('description', '')
                states = item.get('states', [])

                existing = await tx.asset.find_first(where={
                    'projectId': id, 'episode': episode, 'type': asset_type, 'name': name
                }, include={'states': True})

                if existing:
                    await tx.asset.update(where={'id': existing.id}, data={'description': description})
                    existing_states = {s.name: s for s in existing.states}
                    for state in states:
                        sname = state.get('name', '')
                        if not sname:
                            continue
                        sdesc = state.get('description', '')
                        if sname in existing_states:
                            await tx.assetstate.update(where={'id': existing_states[sname].id}, data={
                                'description': sdesc, 'prompt': sdesc, 'scenes': str(state.get('scenes', []))
                            })
                        else:
                            await tx.assetstate.create({
                                'assetId': existing.id, 'name': sname,
                                'description': sdesc, 'prompt': sdesc,
                                'scenes': str(state.get('scenes', []))
                            })
                    updated += 1
                else:
                    asset = await tx.asset.create({
                        'projectId': id, 'episode': episode, 'type': asset_type,
                        'name': name, 'description': description
                    })
                    for state in states:
                        sname = state.get('name', '')
                        if not sname:
                            continue
                        sdesc = state.get('description', '')
                        await tx.assetstate.create({
                            'assetId': asset.id, 'name': sname,
                            'description': sdesc, 'prompt': sdesc,
                            'scenes': str(state.get('scenes', []))
                        })
                    created += 1

    return {"status": "success", "assetsCreated": created, "assetsUpdated": updated}

@router.get("/{id}/assets")
async def get_assets(id: str, episode: int = 1, db: Any = Depends(get_db)):
    project = await db.project.find_first(where={'id': id})
    if not project:
        return {"status": "error", "details": "Project not found"}
    assets = await db.asset.find_many(where={'projectId': id, 'episode': episode}, include={'states': {}})
    result = {"characters": [], "locations": [], "props": []}
    for a in assets:
        entry = {"id": a.id, "name": a.name, "description": a.description or "", "characteristics": a.characteristics or ""}
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
        if 'characteristics' in payload:
            data['characteristics'] = payload['characteristics']
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

@router.patch("/{id}/assets/{asset_id}/states/{state_id}")
async def update_asset_state(id: str, asset_id: str, state_id: str, payload: dict, db: Any = Depends(get_db)):
    """Updates a single asset state (prompt, name, description, imagePath, characterSheet)."""
    try:
        state = await db.assetstate.find_first(where={'id': state_id, 'assetId': asset_id})
        if not state:
            return {"status": "error", "details": "State not found"}
        data = {}
        for k in ('name', 'description', 'prompt', 'imagePath', 'characterSheet'):
            if k in payload:
                data[k] = payload[k]
        if 'scenes' in payload:
            data['scenes'] = str(payload['scenes'])
        if data:
            await db.assetstate.update(where={'id': state_id}, data=data)
        return {"status": "success"}
    except Exception as e:
        print(f"DEBUG: Error in update_asset_state: {e}")
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
async def add_asset(id: str, payload: dict, episode: int = 1, db: Any = Depends(get_db)):
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
            asset = await db.asset.create({'projectId': id, 'episode': episode, 'type': asset_type, 'name': asset_name, 'description': asset_desc})
            await db.assetstate.create({'assetId': asset.id, 'name': state_name, 'description': state_desc, 'prompt': state_desc, 'scenes': '[]'})
            return {"status": "success"}
    except Exception as e:
        print(f"DEBUG: Error in add_asset: {e}")
        return {"status": "error", "details": str(e)}

@router.post("/{id}/assets/{asset_id}/generate-image")
async def generate_image(id: str, asset_id: str, payload: dict, db: Any = Depends(get_db)):
    """Generate an image for an asset state using the mapped ComfyUI workflow."""
    try:
        asset = await db.asset.find_first(where={'id': asset_id, 'projectId': id})
        if not asset:
            return {"status": "error", "details": "Asset not found"}

        state_id = payload.get('stateId', '')
        state = await db.assetstate.find_first(where={'id': state_id, 'assetId': asset_id})
        if not state:
            return {"status": "error", "details": "State not found"}

        prompt = state.prompt or state.description or ''
        if not prompt:
            return {"status": "error", "details": "No prompt available for this state"}

        # Get the mapped workflow file
        wf_mapping = await db.comfyworkflowmapping.find_first(where={'action': 'Asset Generation'})
        if not wf_mapping or not wf_mapping.workflowFile:
            return {"status": "error", "details": "No workflow mapped for Asset Generation"}

        workflow_path = os.path.join(WORKFLOWS_DIR, wf_mapping.workflowFile)
        if not os.path.exists(workflow_path):
            return {"status": "error", "details": f"Workflow file not found: {wf_mapping.workflowFile}"}

        with open(workflow_path, "r", encoding="utf-8") as f:
            workflow_data = json.load(f)

        # Get resolution settings
        res = DEFAULT_RESOLUTIONS
        if wf_mapping.resolutionJson:
            try:
                res = json.loads(wf_mapping.resolutionJson)
            except Exception:
                pass

        type_key = asset.type.lower()  # character, location, prop
        w = res.get(type_key, {}).get('w', 1024)
        h = res.get(type_key, {}).get('h', 1024)
        seed = random.randint(0, 2**32 - 1)

        # M3: guard against non-dict workflow data (e.g. UI-format {"nodes":[...]})
        if not isinstance(workflow_data, dict):
            return {"status": "error", "details": "Workflow file is not a valid node map"}

        # Inject inputs into workflow nodes (case-insensitive role matching)
        for node_id, node_data in workflow_data.items():
            if not isinstance(node_data, dict):
                continue
            title = node_data.get('_meta', {}).get('title', '').lower()
            inputs = node_data.setdefault('inputs', {})
            if '(input:prompt)' in title:
                inputs['value'] = prompt
            elif '(input:seed)' in title:
                inputs['value'] = seed
            elif '(input:width)' in title:
                inputs['value'] = w
            elif '(input:height)' in title:
                inputs['value'] = h

        # Get ComfyUI settings
        comfyui = await db.comfyuisettings.find_first()
        if not comfyui:
            return {"status": "error", "details": "ComfyUI settings not found"}

        comfy_http = f"http://{comfyui.ip}:{comfyui.port}"
        task_id = str(uuid.uuid4())

        async with httpx.AsyncClient(timeout=30.0) as client:
            queue_res = await client.post(f"{comfy_http}/prompt", json={"prompt": workflow_data})
            if queue_res.status_code != 200:
                return {"status": "error", "details": f"ComfyUI rejected prompt: {queue_res.text}"}
            prompt_id = queue_res.json()["prompt_id"]
            asset_gen_tasks[task_id] = prompt_id
            asset_gen_tasks[f"{task_id}_state"] = state_id

        print(f"[AssetGen] task_id={task_id} prompt_id={prompt_id} asset={asset.name} state={state.name}")
        return {"status": "success", "task_id": task_id}
    except Exception as e:
        print(f"DEBUG: Error in generate_image: {e}")
        return {"status": "error", "details": str(e)}

@router.get("/{id}/assets/{asset_id}/generate-image/status/{task_id}")
async def check_image_status(id: str, asset_id: str, task_id: str, db: Any = Depends(get_db)):
    """Check if an asset image generation is complete. Returns image or pending."""
    if task_id not in asset_gen_tasks:
        return {"status": "error", "details": "Task not found"}

    prompt_id = asset_gen_tasks[task_id]
    comfyui = await db.comfyuisettings.find_first()
    if not comfyui:
        return {"status": "error", "details": "ComfyUI settings not found"}

    comfy_http = f"http://{comfyui.ip}:{comfyui.port}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        history_res = await client.get(f"{comfy_http}/history/{prompt_id}")
        history_data = history_res.json()
        entry = history_data.get(prompt_id, {})
        outputs = entry.get("outputs", {})

        # M1: check for ComfyUI errors before assuming pending
        status_info = entry.get("status", {})
        if status_info.get("status") == "error":
            detail = status_info.get("message", "ComfyUI generation failed")
            asset_gen_tasks.pop(task_id, None)
            asset_gen_tasks.pop(f"{task_id}_state", None)
            asset_gen_tasks.pop(f"{task_id}_field", None)
            return {"status": "error", "details": detail, "task_id": task_id}

        image_info = None
        for node_output in outputs.values():
            if "images" in node_output and len(node_output["images"]) > 0:
                image_info = node_output["images"][0]
                break

        if not image_info:
            return {"status": "pending", "task_id": task_id}

        # M31: claim the task atomically to prevent double-processing
        # (two concurrent polls could both see the image and both save)
        claimed = asset_gen_tasks.pop(task_id, None)
        state_id = asset_gen_tasks.pop(f"{task_id}_state", None)
        field = asset_gen_tasks.pop(f"{task_id}_field", "imagePath")
        if claimed is None:
            return {"status": "pending", "task_id": task_id}

        params = {
            "filename": image_info["filename"],
            "subfolder": image_info.get("subfolder", ""),
            "type": image_info.get("type", "output"),
        }
        img_res = await client.get(f"{comfy_http}/view", params=params)

        # M2: save with a stable name (task_id) instead of ComfyUI's counter name
        os.makedirs(GENERATED_DIR, exist_ok=True)
        gen_dir = GENERATED_DIR
        ext = os.path.splitext(image_info["filename"])[1] or ".png"
        stable_name = f"{task_id}{ext}"
        save_path = os.path.join(gen_dir, stable_name)
        with open(save_path, "wb") as f:
            f.write(img_res.content)

        image_path = f"/assets/generated/{stable_name}"

        # Update the state's imagePath in DB (stored in task tracker)
        if state_id:
            await db.assetstate.update(where={'id': state_id}, data={field: image_path})

        print(f"[AssetGen] task_id={task_id} -> COMPLETE ({image_info['filename']})")
        return {"status": "complete", "imagePath": image_path, "task_id": task_id}

@router.post("/{id}/assets/{asset_id}/generate-sheet")
async def generate_sheet(id: str, asset_id: str, payload: dict, db: Any = Depends(get_db)):
    """Generate a character sheet using the mapped ComfyUI workflow. Requires an existing image."""
    try:
        asset = await db.asset.find_first(where={'id': asset_id, 'projectId': id})
        if not asset:
            return {"status": "error", "details": "Asset not found"}

        state_id = payload.get('stateId', '')
        state = await db.assetstate.find_first(where={'id': state_id, 'assetId': asset_id})
        if not state:
            return {"status": "error", "details": "State not found"}

        image_path = state.imagePath or ''
        if not image_path:
            return {"status": "error", "details": "No image assigned to this state. Generate or assign an image first."}

        # Get the mapped workflow file
        wf_mapping = await db.comfyworkflowmapping.find_first(where={'action': 'Character Sheet Generation'})
        if not wf_mapping or not wf_mapping.workflowFile:
            return {"status": "error", "details": "No workflow mapped for Character Sheet Generation"}

        workflow_path = os.path.join(WORKFLOWS_DIR, wf_mapping.workflowFile)
        if not os.path.exists(workflow_path):
            return {"status": "error", "details": f"Workflow file not found: {wf_mapping.workflowFile}"}

        with open(workflow_path, "r", encoding="utf-8") as f:
            workflow_data = json.load(f)

        # Get ComfyUI settings
        comfyui = await db.comfyuisettings.find_first()
        if not comfyui:
            return {"status": "error", "details": "ComfyUI settings not found"}

        comfy_http = f"http://{comfyui.ip}:{comfyui.port}"

        # Upload the image to ComfyUI
        # image_path is like /assets/generated/filename.png — strip the /assets/ prefix
        # and join onto the assets directory to get the real filesystem path.
        assets_dir = os.path.abspath(os.path.join(base_dir, "..", "assets"))
        rel = image_path.replace('/assets/', '', 1) if image_path.startswith('/assets/') else image_path.lstrip('/')
        local_path = os.path.join(assets_dir, rel)
        if not os.path.exists(local_path):
            return {"status": "error", "details": f"Image file not found: {image_path}"}

        with open(local_path, "rb") as f:
            file_bytes = f.read()

        filename = os.path.basename(image_path)
        files = {"image": (filename, file_bytes, "image/png")}
        data = {"overwrite": "true"}

        async with httpx.AsyncClient(timeout=15.0) as client:
            upload_res = await client.post(f"{comfy_http}/upload/image", files=files, data=data)
            if upload_res.status_code != 200:
                return {"status": "error", "details": f"ComfyUI rejected upload: {upload_res.text}"}
            uploaded_name = upload_res.json()["name"]

        # M3: guard against non-dict workflow data
        if not isinstance(workflow_data, dict):
            return {"status": "error", "details": "Workflow file is not a valid node map"}

        # Inject image + seed into workflow
        seed = random.randint(0, 2**32 - 1)
        for node_id, node_data in workflow_data.items():
            if not isinstance(node_data, dict):
                continue
            title = node_data.get('_meta', {}).get('title', '')
            if '(Input:image)' in title:
                node_data.setdefault('inputs', {})['image'] = uploaded_name
            elif '(Input:seed)' in title:
                node_data.setdefault('inputs', {})['value'] = seed

        task_id = str(uuid.uuid4())

        async with httpx.AsyncClient(timeout=30.0) as client:
            queue_res = await client.post(f"{comfy_http}/prompt", json={"prompt": workflow_data})
            if queue_res.status_code != 200:
                return {"status": "error", "details": f"ComfyUI rejected prompt: {queue_res.text}"}
            prompt_id = queue_res.json()["prompt_id"]
            asset_gen_tasks[task_id] = prompt_id
            asset_gen_tasks[f"{task_id}_state"] = state_id
            asset_gen_tasks[f"{task_id}_field"] = "characterSheet"

        print(f"[SheetGen] task_id={task_id} prompt_id={prompt_id} asset={asset.name} state={state.name}")
        return {"status": "success", "task_id": task_id}
    except Exception as e:
        print(f"DEBUG: Error in generate_sheet: {e}")
        return {"status": "error", "details": str(e)}
