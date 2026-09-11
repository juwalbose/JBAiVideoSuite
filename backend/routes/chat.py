from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any, Optional
import requests
from database import get_db

router = APIRouter(prefix="/chat", tags=["Chat"])

# In-memory session tracking: session_id -> active system prompt
active_system_prompts: dict[str, Optional[str]] = {}

class ChatMessage(BaseModel):
    role: str
    content: str

CLEAR_SENTINEL = "__CLEAR__"

class ChatRequest(BaseModel):
    session_id: str
    messages: list[ChatMessage]
    system_prompt: Optional[str] = None

@router.post("/")
async def chat(req: ChatRequest, db: Any = Depends(get_db)):
    llm = await db.llmsettings.find_first()
    if not llm:
        return {"status": "error", "details": "No LLM settings found in database."}

    ip, port, modelName, temperature = llm.ip, llm.port, llm.modelName, llm.temperature

    # Update the active system prompt for this session
    # None = clear, "__CLEAR__" = explicit clear, string = set/change
    print(f"[CHAT] session={req.session_id}, system_prompt={repr(req.system_prompt)}")
    if req.system_prompt is None or req.system_prompt == CLEAR_SENTINEL:
        active_system_prompts[req.session_id] = None
    else:
        active_system_prompts[req.session_id] = req.system_prompt

    # Build messages: prepend the active system prompt if one is set
    messages = []
    current_sp = active_system_prompts.get(req.session_id)
    print(f"[CHAT] active_sp for {req.session_id} = {repr(current_sp[:50] if current_sp else None)}...")
    if current_sp:
        messages.append({"role": "system", "content": current_sp})
    for msg in req.messages:
        messages.append({"role": msg.role, "content": msg.content})

    url = f"http://{ip}:{port}/v1/chat/completions"
    payload = {
        "model": modelName,
        "messages": messages,
        "temperature": temperature,
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        return {"status": "success", "response": result}
    except Exception as e:
        return {"status": "error", "details": str(e)}

@router.post("/clear")
async def clear_prompt(session_id: str):
    active_system_prompts[session_id] = None
    return {"status": "success"}
