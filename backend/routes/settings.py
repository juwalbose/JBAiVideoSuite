from fastapi import APIRouter, Depends
from typing import Any
import httpx
from database import get_db
from models import (
    LLMSettingsModel, 
    BackendSettingsModel, 
    ComfyUISettingsModel
)

router = APIRouter(prefix="/settings", tags=["Settings"])

async def call_llm(prompt: str, db) -> str:
    """Helper to call LM Studio's local LLM using the OpenAI SDK."""
    llm = await db.llmsettings.find_first()
    if not llm:
        return "LM Studio Error: No LLM settings found in database."

    ip, port, modelName, temperature = llm.ip, llm.port, llm.modelName, llm.temperature

    url = f"http://{ip}:{port}/v1/chat/completions"
    payload = {
        "model": modelName, 
        "messages": [
            {"role": "system", "content": "You are a creative video production assistant."},
            {"role": "user", "content": prompt}
        ],
        "temperature": temperature,
    }
    timeout = httpx.Timeout(300.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
            print(f'DEBUG: Request sent to {url}')
            print(f'DEBUG: Response Status Code: {response.status_code}')
            response.raise_for_status()
            result = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
            print(f'DEBUG: LLM Result received: {result[:50]}...')
            return result
    except Exception as e:
        print(f'DEBUG: Error in call_llm: {e}')
        return f"LM Studio Error: {str(e)}"

@router.get("/")
async def get_settings(db = Depends(get_db)):
    """Fetch all settings from the database."""
    llm = await db.llmsettings.find_first()
    backend = await db.backendsettings.find_first()
    comfyui = await db.comfyuisettings.find_first()

    return {
        "llm": llm if llm else {
            "ip": "192.168.1.66",
            "port": 1234,
            "modelName": "gemma-4-e4b-uncensored-hauhaucs-aggressive",
            "temperature": 0.7,
            "maxTokens": 512,
        },
        "backend": backend if backend else {
            "apiUrl": "http://127.0.0.1:8000",
            "dbPath": "backend/prisma/database.db",
        },
        "comfyui": comfyui if comfyui else {
            "ip": "127.0.0.1",
            "port": 8188,
            "deviceId": "0",
            "pollInterval": 4000,
            "taskTTL": 600,
        }
    }

@router.post("/save-llm")
async def save_llm_settings(settings: LLMSettingsModel, db = Depends(get_db)):
    llm = await db.llmsettings.find_first()
    if llm:
        await db.llmsettings.update({
            "ip": settings.ip,
            "port": settings.port,
            "modelName": settings.modelName,
            "temperature": settings.temperature,
            "maxTokens": settings.maxTokens
        }, where={"id": llm.id})
    else:
        await db.llmsettings.create(**settings.dict())
    return {"status": "success", "data": settings}

@router.post("/save-backend")
async def save_backend_settings(settings: BackendSettingsModel, db = Depends(get_db)):
    backend = await db.backendsettings.find_first()
    if backend:
        await db.backendsettings.update({
            "apiUrl": settings.apiUrl,
            "dbPath": settings.dbPath
        }, where={"id": backend.id})
    else:
        await db.backendsettings.create(**settings.dict())
    return {"status": "success", "data": settings}

@router.post("/save-comfyui")
async def save_comfyui_settings(settings: ComfyUISettingsModel, db = Depends(get_db)):
    comfy = await db.comfyuisettings.find_first()
    if comfy:
        await db.comfyuisettings.update({
            "ip": settings.ip,
            "port": settings.port,
            "deviceId": settings.deviceId,
            "pollInterval": settings.pollInterval,
            "taskTTL": settings.taskTTL
        }, where={"id": comfy.id})
    else:
        await db.comfyuisettings.create(**settings.dict())
    return {"status": "success", "data": settings}
