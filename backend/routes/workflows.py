from fastapi import APIRouter
import os
import json

from paths import WORKFLOWS_DIR

router = APIRouter(prefix="/workflows", tags=["Workflows"])

def _safe_workflow_path(filename: str) -> str | None:
    """Return a safe absolute path inside WORKFLOWS_DIR, or None if the name is unsafe."""
    base = os.path.basename(filename)
    if base != filename or "/" in base or "\\" in base or base.startswith("."):
        return None
    if not base.lower().endswith(".json"):
        return None
    path = os.path.realpath(os.path.join(WORKFLOWS_DIR, base))
    if not path.startswith(os.path.realpath(WORKFLOWS_DIR)):
        return None
    return path

@router.get("/")
async def list_workflows():
    if not os.path.exists(WORKFLOWS_DIR):
        os.makedirs(WORKFLOWS_DIR)

    files = [f for f in os.listdir(WORKFLOWS_DIR) if f.endswith('.json')]
    return [{"id": f, "name": f.replace('.json', '')} for f in files]

@router.post("/add")
async def add_workflow(payload: dict):
    name = payload.get("name", "")
    json_content = payload.get("json_content", "")
    if not name:
        return {"status": "error", "details": "Missing name"}
    filename = f"{name}.json"
    filepath = _safe_workflow_path(filename)
    if filepath is None:
        return {"status": "error", "details": "Invalid workflow name"}
    if not os.path.exists(WORKFLOWS_DIR):
        os.makedirs(WORKFLOWS_DIR, exist_ok=True)
    with open(filepath, 'w') as f:
        f.write(json_content)
    return {"status": "success", "filename": filename}
