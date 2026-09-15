from fastapi import APIRouter, Depends
from typing import Any
import httpx
from database import get_db
from models import HandshakeResponse

router = APIRouter()

@router.get("/handshake")
async def check_lmstudio_health(db = Depends(get_db)):
    llm = await db.llmsettings.find_first()
    if not llm:
        ip, port = "192.168.1.66", 1234
    else:
        ip, port = llm.ip, llm.port

    BASE_URL = f"http://{ip}:{port}/v1"
    timeout = httpx.Timeout(3.0, connect=2.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.get(f"{BASE_URL}/models")
            if response.status_code != 200:
                return HandshakeResponse(
                    status="unhealthy",
                    server_reachable=False,
                    active_model="unknown",
                    ping_success=False,
                    details=f"LM Studio responded with HTTP {response.status_code}"
                )

            data = response.json()
            model_list = data.get("data", [])

            if not model_list:
                return HandshakeResponse(
                    status="no_models",
                    server_reachable=True,
                    active_model="No Model Loaded",
                    ping_success=True,
                    details="LM Studio is ready, but no models are loaded."
                )

            active_model = model_list[0].get("id", model_list[0].get("name", "Unnamed Model"))

            return HandshakeResponse(
                status="healthy",
                server_reachable=True,
                active_model=active_model,
                ping_success=True,
                details="LM Studio is ready."
            )
        except Exception as e:
            return HandshakeResponse(
                status="unhealthy",
                server_reachable=False,
                active_model="unknown",
                ping_success=False,
                details=str(e)
            )

@router.post("/llm/load")
async def load_llm(payload: dict = {}, db = Depends(get_db)):
    """Loads the configured model (from LLMSettings.modelName) via LM Studio's /api/v1/models/load."""
    llm = await db.llmsettings.find_first()
    if not llm:
        return {"status": "error", "details": "No LLM settings found"}

    model_id = payload.get("model") or llm.modelName
    if not model_id:
        return {"status": "error", "details": "No model specified"}

    ip, port = llm.ip, llm.port
    base = f"http://{ip}:{port}/api/v1"
    timeout = httpx.Timeout(30.0, connect=3.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(f"{base}/models/load", json={"model": model_id})
            data = resp.json()
            return {"status": "success", "model": model_id, "details": data.get("status", "Model loaded")}
        except Exception as e:
            return {"status": "error", "details": str(e)}

@router.post("/llm/unload")
async def unload_llm(db = Depends(get_db)):
    """Unloads the currently active model via LM Studio's /api/v1/models/unload."""
    llm = await db.llmsettings.find_first()
    if not llm:
        return {"status": "error", "details": "No LLM settings found"}

    ip, port = llm.ip, llm.port
    timeout = httpx.Timeout(10.0, connect=3.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            # Use OpenAI-compat endpoint to get loaded models
            resp = await client.get(f"http://{ip}:{port}/v1/models")
            resp.raise_for_status()
            model_list = resp.json().get("data", [])
            if not model_list:
                return {"status": "error", "details": "No models loaded"}
            instance_id = model_list[0].get("id", "")
            unload_resp = await client.post(f"http://{ip}:{port}/api/v1/models/unload", json={"instance_id": instance_id})
            unload_data = unload_resp.json()
            return {"status": "success", "model": instance_id, "details": "Model unloaded"}
        except Exception as e:
            return {"status": "error", "details": str(e)}

@router.get("/llm-test")
async def test_llm(db = Depends(get_db)):
    llm = await db.llmsettings.find_first()
    if not llm:
        return {"status": "error", "details": "No LLM settings found in database."}

    ip, port = llm.ip, llm.port
    url = f"http://{ip}:{port}/v1/models"

    try:
        response = requests.get(url)
        if response.status_code != 200:
            return {
                "status": "unhealthy", 
                "server_reachable": False, 
                "ping_success": False, 
                "details": f"LM Studio responded with HTTP {response.status_code}"
            }
        
        data = response.json()
        model_list = data.get("data", [])
        
        if not model_list:
            return {
                "status": "no_models", 
                "server_reachable": True, 
                "active_model": "No Model Loaded", 
                "ping_success": True, 
                "details": "LM Studio is ready, but no models are loaded.",
                "models": []
            }

        active_model = model_list[0].get("id", "Unnamed Model")

        return {
            "status": "healthy",
            "server_reachable": True,
            "active_model": active_model,
            "ping_success": True,
            "details": f"Connected to LM Studio at {ip}:{port}",
            "models": model_list
        }
    except Exception as e:
        return {
            "status": "unhealthy", 
            "server_reachable": False, 
            "ping_success": False, 
            "details": str(e)
        }
