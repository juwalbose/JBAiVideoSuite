from fastapi import APIRouter, Query
import os
import json
from typing import List

router = APIRouter(prefix="/workflows", tags=["Workflows"])

# Get the directory of the current file (backend/routes/workflows.py)
current_dir = os.path.dirname(os.path.abspath(__file__))
# Go up two levels to reach the root, then into assets/workflows
WORKFLOWS_DIR = os.path.abspath(os.path.join(current_dir, "..", "..", "assets", "workflows"))

@router.get("/")
async def list_workflows():
    if not os.path.exists(WORKFLOWS_DIR):
        os.makedirs(WORKFLOWS_DIR)
    
    files = [f for f in os.listdir(WORKFLOWS_DIR) if f.endswith('.json')]
    # Return names without the .json extension
    return [{"id": f, "name": f.replace('.json', '')} for f in files]

@router.post("/add")
async def add_workflow(name: str, json_content: str):
    # This will be used when we want to add a workflow from the UI
    filename = f"{name}.json"
    filepath = os.path.join(WORKFLOWS_DIR, filename)
    with open(filepath, 'w') as f:
        f.write(json_content)
    return {"status": "success", "filename": filename}