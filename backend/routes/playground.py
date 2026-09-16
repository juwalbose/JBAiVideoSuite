from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os
import json
import time
import uuid
import asyncio
import httpx
from database import get_db
from paths import WORKFLOWS_DIR, GENERATED_DIR
from .playground_parser import PlaygroundParser

router = APIRouter(prefix="/playground", tags=["Playground"])

# In-memory task tracker: task_id -> (prompt_id, timestamp)
active_tasks: Dict[str, tuple] = {}

# Default TTL (seconds) — overridden by ComfyUISettings.taskTTL from DB
DEFAULT_TASK_TTL = 600  # 10 minutes

@router.get("/list")
def list_workflows():
    files = os.listdir(WORKFLOWS_DIR)
    workflow_files = sorted([f for f in files if f.endswith(".json")])
    return [
        {"id": f.replace(".json", ""), "name": f.replace(".json", "").replace("_", " ")}
        for f in workflow_files
    ]

class GenerateRequest(BaseModel):
    workflow_id: str
    inputs: Dict[str, Any]

@router.get("/parse/{filename}")
def parse_workflow(filename: str):
    parser = PlaygroundParser()
    result = parser.parse(filename)
    if not result.get("is_valid") and "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

def _inject_inputs(workflow_data: dict, inputs: Dict[str, Any]) -> dict:
    """Inject inputs into workflow nodes. Returns modified workflow."""
    for role, value in inputs.items():
        if (
            (role.startswith("image") or role.startswith("audio"))
            and isinstance(value, list)
            and len(value) >= 2
        ):
            node_id = str(value[0])
            filename = str(value[1])
            if node_id in workflow_data:
                input_key = "image" if role.startswith("image") else "audio"
                workflow_data[node_id].setdefault("inputs", {})[input_key] = filename
            continue

        target_node_id = None
        for nid, ndata in workflow_data.items():
            title = ndata.get("_meta", {}).get("title", "")
            if f"(Input:{role})" in title:
                target_node_id = nid
                break

        if target_node_id and target_node_id in workflow_data:
            inputs_dict = workflow_data[target_node_id].setdefault("inputs", {})
            if "value" in inputs_dict:
                inputs_dict["value"] = value
            elif role == "prompt":
                inputs_dict["text"] = value
            else:
                inputs_dict[role] = value
    return workflow_data

@router.post("/generate")
async def generate(request: GenerateRequest, db: Any = Depends(get_db)):
    """Submit a generation to the ComfyUI queue. Returns task_id immediately."""
    workflow_id = request.workflow_id
    inputs = request.inputs

    full_path = os.path.join(WORKFLOWS_DIR, f"{workflow_id}.json")
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found.")

    with open(full_path, "r", encoding="utf-8") as f:
        workflow_data = json.load(f)

    workflow_data = _inject_inputs(workflow_data, inputs)

    print(f"\n--- Queued Workflow ({workflow_id}) ---")
    print(json.dumps(workflow_data, indent=2))
    print("-----------------------------------------------\n")

    comfyui = await db.comfyuisettings.find_first()
    if not comfyui:
        raise HTTPException(status_code=500, detail="ComfyUI settings not found in database.")

    comfy_ip = comfyui.ip
    comfy_port = comfyui.port
    comfy_http = f"http://{comfy_ip}:{comfy_port}"

    task_id = str(uuid.uuid4())

    async with httpx.AsyncClient(timeout=30.0) as client:
        payload = {"prompt": workflow_data}
        queue_res = await client.post(f"{comfy_http}/prompt", json=payload)

        if queue_res.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"ComfyUI rejected prompt: {queue_res.text}",
            )

        prompt_id = queue_res.json()["prompt_id"]
        active_tasks[task_id] = (prompt_id, time.time())
        print(f"[Queue] task_id={task_id} prompt_id={prompt_id} (active: {len(active_tasks)})")

    # Small delay to let ComfyUI register the prompt in history before we return
    await asyncio.sleep(0.5)

    return {"task_id": task_id, "prompt_id": prompt_id}

@router.get("/status/{task_id}")
async def check_status(task_id: str, db: Any = Depends(get_db)):
    """Check if a queued generation is complete. Returns image or pending status."""
    if task_id not in active_tasks:
        print(f"[Status] task_id={task_id} NOT FOUND in active_tasks ({len(active_tasks)} tasks)")
        raise HTTPException(status_code=404, detail="Task not found.")

    prompt_id, _ts = active_tasks[task_id]

    comfyui = await db.comfyuisettings.find_first()
    if not comfyui:
        raise HTTPException(status_code=500, detail="ComfyUI settings not found.")

    comfy_http = f"http://{comfyui.ip}:{comfyui.port}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        history_res = await client.get(f"{comfy_http}/history/{prompt_id}")
        history_data = history_res.json()

        outputs = history_data.get(prompt_id, {}).get("outputs", {})
        output_info = None
        output_type = None
        for node_output in outputs.values():
            if "images" in node_output and len(node_output["images"]) > 0:
                output_info = node_output["images"][0]
                output_type = "image"
                break
            if "gifs" in node_output and len(node_output["gifs"]) > 0:
                output_info = node_output["gifs"][0]
                output_type = "video"
                break

        if not output_info:
            print(f"[Status] task_id={task_id} prompt_id={prompt_id} -> PENDING")
            return {"status": "pending", "task_id": task_id}

        params = {
            "filename": output_info["filename"],
            "subfolder": output_info.get("subfolder", ""),
            "type": output_info.get("type", "output"),
        }
        file_res = await client.get(f"{comfy_http}/view", params=params)

        os.makedirs(GENERATED_DIR, exist_ok=True)
        save_path = os.path.join(GENERATED_DIR, output_info["filename"])
        with open(save_path, "wb") as f:
            f.write(file_res.content)

        media_type = "video/mp4" if output_type == "video" else "image/png"
        print(f"[Status] task_id={task_id} prompt_id={prompt_id} -> COMPLETE ({output_info['filename']}) [{output_type}]")

        return Response(
            content=file_res.content,
            media_type=media_type,
            headers={
                "Content-Disposition": f'inline; filename="{output_info["filename"]}"',
                "X-Task-Status": "complete",
            },
        )

@router.delete("/status/{task_id}")
async def remove_task(task_id: str):
    """Remove a completed task from the tracker after the frontend confirms receipt."""
    if task_id in active_tasks:
        prompt_id, _ts = active_tasks.pop(task_id)
        print(f"[Cleanup] task_id={task_id} prompt_id={prompt_id} removed (active: {len(active_tasks)})")
        return {"status": "removed", "task_id": task_id}
    return {"status": "not_found", "task_id": task_id}

async def _purge_stale_tasks(db):
    """Remove tasks older than the configured TTL (from ComfyUISettings.taskTTL)."""
    comfyui = await db.comfyuisettings.find_first()
    ttl = comfyui.taskTTL if comfyui and comfyui.taskTTL else DEFAULT_TASK_TTL
    now = time.time()
    stale = [tid for tid, (_pid, ts) in active_tasks.items() if now - ts > ttl]
    for tid in stale:
        del active_tasks[tid]
        print(f"[Cleanup] purged stale task {tid} (ttl={ttl}s)")

@router.get("/active")
async def get_active_tasks(db: Any = Depends(get_db)):
    """Return all active task IDs so the frontend can poll them all."""
    await _purge_stale_tasks(db)
    return {"tasks": list(active_tasks.keys()), "count": len(active_tasks)}

@router.delete("/active")
async def clear_all_tasks():
    """Clear all active tasks (cleanup stale entries from previous runs)."""
    count = len(active_tasks)
    active_tasks.clear()
    print(f"[Cleanup] Cleared all tasks ({count} removed)")
    return {"status": "cleared", "count": count}
