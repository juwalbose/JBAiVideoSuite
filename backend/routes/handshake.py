from fastapi import APIRouter, Depends
from typing import Any
import requests
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

    try:
        models_response = requests.get(f"{BASE_URL}/models")
        if models_response.status_code != 200:
            return HandshakeResponse(
                status="unhealthy",
                server_reachable=False,
                active_model="unknown",
                ping_success=False,
                details=f"LM Studio responded with HTTP {models_response.status_code}"
            )

        data = models_response.json()
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
