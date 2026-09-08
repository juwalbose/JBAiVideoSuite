from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
from typing import Dict, Any
import os
import time
import json
import uuid
import httpx
import websockets
from database import get_db
from .playground_parser import PlaygroundParser

router = APIRouter(prefix="/playground", tags=["Playground"])

@router.get("/list")
def list_workflows():
    """
    Returns a list of all workflow files in the assets/workflows directory.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    workflow_dir = os.path.join(base_dir, "..", "assets", "workflows")
    
    files = os.listdir(workflow_dir)
    # Filter for .json files and sort them alphabetically
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
    """
    Returns a structured playground object for a given workflow file.
    Example: /playground/parse/Krea2_T2I_Legion
    """
    parser = PlaygroundParser()
    result = parser.parse(filename)
    
    if not result.get("is_valid") and "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
        
    return result

@router.post("/generate")
async def generate(request: GenerateRequest, db: Any = Depends(get_db)):
    workflow_id = request.workflow_id
    inputs = request.inputs
    
    # 1. Load the workflow JSON
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    full_path = os.path.join(base_dir, "..", "assets", "workflows", f"{workflow_id}.json")
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found.")
    
    with open(full_path, 'r') as f:
        workflow_data = json.load(f)

    # 2. Inject the values into the correct nodes
    for role, value in inputs.items():
        for node_id, node_data in workflow_data.items():
            title = node_data.get('_meta', {}).get('title', '')
            if f"(Input:{role})" in title:
                inputs_dict = node_data.get("inputs", {})
                # If the node uses a "value" key (like Krea2)
                if "value" in inputs_dict:
                    if role == "prompt":
                        inputs_dict["value"] = value if isinstance(value, (int, float)) else value
                    else:
                        inputs_dict["value"] = value if isinstance(value, (int, float)) else [value]
                # Otherwise use the role name as the key (like Flux2)
                else:
                    if role == "prompt":
                        inputs_dict[role] = value if isinstance(value, (int, float)) else value
                    else:
                        inputs_dict[role] = value if isinstance(value, (int, float)) else [value]

    # Log the modified JSON to terminal for debugging
    print(f"\n--- Modified Workflow JSON ({workflow_id}) ---")
    print(json.dumps(workflow_data, indent=2))
    print("-----------------------------------------------\n")

    # 3. Fetch ComfyUI Settings from DB
    comfyui = await db.comfyuisettings.find_first()
    if not comfyui:
        raise HTTPException(status_code=500, detail="ComfyUI settings not found in database.")
    
    comfy_ip = comfyui.ip
    comfy_port = comfyui.port
    comfy_http = f"http://{comfy_ip}:{comfy_port}"
    comfy_ws = f"ws://{comfy_ip}:{comfy_port}/ws"

    client_id = str(uuid.uuid4())

    # 4. ComfyUI Generation Round Trip
    async with httpx.AsyncClient() as client:
        # Connect to WebSocket
        async with websockets.connect(f"{comfy_ws}?clientId={client_id}") as ws:
            # Enqueue the workflow
            payload = {"prompt": workflow_data, "client_id": client_id}
            queue_res = await client.post(f"{comfy_http}/prompt", json=payload)

            if queue_res.status_code != 200:
                raise HTTPException(status_code=500, detail=f"ComfyUI rejected prompt: {queue_res.text}")

            prompt_id = queue_res.json()["prompt_id"]

            # Listen to WebSocket events until completion
            while True:
                raw_msg = await ws.recv()
                if isinstance(raw_msg, str):
                    event = json.loads(raw_msg)
                    msg_type = event.get("type")
                    msg_data = event.get("data", {})

                    if (msg_type == "executing" and msg_data.get("node") is None 
                        and msg_data.get("prompt_id") == prompt_id):
                        break

            # Retrieve output image metadata from ComfyUI history
            history_res = await client.get(f"{comfy_http}/history/{prompt_id}")
            history_data = history_res.json()

            outputs = history_data[prompt_id].get("outputs", {})
            image_info = None

            for node_id, node_output in outputs.items():
                if "images" in node_output and len(node_output["images"]) > 0:
                    image_info = node_output["images"][0]
                    break

            if not image_info:
                raise HTTPException(status_code=500, detail="No output image produced.")

            # Fetch raw image bytes from ComfyUI
            params = {
                "filename": image_info["filename"],
                "subfolder": image_info.get("subfolder", ""),
                "type": image_info.get("type", "output"),
            }
            img_res = await client.get(f"{comfy_http}/view", params=params)

            # Save the result to assets/generated/
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            gen_dir = os.path.join(base_dir, "..", "assets", "generated")
            os.makedirs(gen_dir, exist_ok=True)
            
            save_path = os.path.join(gen_dir, image_info["filename"])
            with open(save_path, 'wb') as f:
                f.write(img_res.content)

            # Return the raw bytes as a Response
            return Response(
                content=img_res.content,
                media_type="image/png",
                headers={
                    "Content-Disposition": f'inline; filename="{image_info["filename"]}"'
                },
            )