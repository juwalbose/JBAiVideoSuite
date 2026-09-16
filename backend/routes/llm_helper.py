import httpx
import os

PROMPTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "systemprompts"))

LLM_TIMEOUT = httpx.Timeout(300.0, connect=10.0)

async def get_system_prompt(db, action: str):
    mapping = await db.appactionmapping.find_first(where={'action': action})
    if not mapping or not mapping.promptFile:
        return None
    filepath = os.path.join(PROMPTS_DIR, mapping.promptFile)
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

async def call_llm(db, system_prompt: str, user_content: str) -> str:
    llm = await db.llmsettings.find_first()
    ip, port, modelName, temperature = llm.ip, llm.port, llm.modelName, llm.temperature
    max_tokens = getattr(llm, 'maxTokens', 4096)
    url = f"http://{ip}:{port}/v1/chat/completions"
    payload = {
        "model": modelName,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
