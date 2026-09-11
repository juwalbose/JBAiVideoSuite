from fastapi import APIRouter
import os

router = APIRouter(prefix="/systemprompts", tags=["SystemPrompts"])

current_dir = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.abspath(os.path.join(current_dir, "..", "..", "assets", "systemprompts"))

@router.get("/")
async def list_prompts():
    if not os.path.exists(PROMPTS_DIR):
        os.makedirs(PROMPTS_DIR)

    files = [f for f in os.listdir(PROMPTS_DIR) if f.endswith('.txt')]
    return [{"id": f, "name": f.replace('.txt', '')} for f in files]

@router.get("/{filename}")
async def get_prompt(filename: str):
    filepath = os.path.join(PROMPTS_DIR, filename)
    if not os.path.exists(filepath):
        return {"status": "error", "details": "Prompt not found"}
    with open(filepath, 'r', encoding='utf-8') as f:
        return {"content": f.read()}

@router.post("/add")
async def add_prompt(name: str, content: str):
    filename = f"{name}.txt"
    filepath = os.path.join(PROMPTS_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return {"status": "success", "filename": filename}
