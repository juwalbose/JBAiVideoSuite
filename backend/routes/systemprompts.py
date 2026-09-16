from fastapi import APIRouter
import os

router = APIRouter(prefix="/systemprompts", tags=["SystemPrompts"])

current_dir = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.abspath(os.path.join(current_dir, "..", "..", "assets", "systemprompts"))

def _safe_prompt_path(filename: str) -> str | None:
    """Return a safe absolute path inside PROMPTS_DIR, or None if the name is unsafe."""
    base = os.path.basename(filename)
    if base != filename or "/" in base or "\\" in base or base.startswith("."):
        return None
    if not base.lower().endswith(".txt"):
        return None
    path = os.path.realpath(os.path.join(PROMPTS_DIR, base))
    if not path.startswith(os.path.realpath(PROMPTS_DIR)):
        return None
    return path

@router.get("/")
async def list_prompts():
    if not os.path.exists(PROMPTS_DIR):
        os.makedirs(PROMPTS_DIR)

    files = [f for f in os.listdir(PROMPTS_DIR) if f.endswith('.txt')]
    return [{"id": f, "name": f.replace('.txt', '')} for f in files]

@router.get("/{filename}")
async def get_prompt(filename: str):
    filepath = _safe_prompt_path(filename)
    if filepath is None or not os.path.exists(filepath):
        return {"status": "error", "details": "Prompt not found"}
    with open(filepath, 'r', encoding='utf-8') as f:
        return {"content": f.read()}

@router.post("/add")
async def add_prompt(payload: dict):
    name = payload.get("name", "")
    content = payload.get("content", "")
    if not name:
        return {"status": "error", "details": "Missing name"}
    filename = f"{name}.txt"
    filepath = _safe_prompt_path(filename)
    if filepath is None:
        return {"status": "error", "details": "Invalid prompt name"}
    if not os.path.exists(PROMPTS_DIR):
        os.makedirs(PROMPTS_DIR, exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return {"status": "success", "filename": filename}
