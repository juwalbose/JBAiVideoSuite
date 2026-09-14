import json
from fastapi import APIRouter, Depends
from typing import Any
from database import get_db
from routes.llm_helper import get_system_prompt, call_llm

router = APIRouter(prefix="/projects", tags=["ShotList"])


@router.get("/{id}/shotlist")
async def get_shotlist(id: str, db: Any = Depends(get_db)):
    shots = await db.shotlist.find_many(where={'projectId': id})
    shots.sort(key=lambda s: s.shot)
    return [s.dict() for s in shots]


@router.post("/{id}/shotlist")
async def save_shotlist(id: str, payload: dict, db: Any = Depends(get_db)):
    shots = payload.get('shots', [])
    # Wipe existing shots for this project
    await db.shotlist.delete_many(where={'projectId': id})
    # Create new shots
    for s in shots:
        beats = s.get('beats', [])
        subs = s.get('subs', '')
        if isinstance(subs, str) and ',' in subs:
            subs = [x.strip() for x in subs.split(',') if x.strip()]
        await db.shotlist.create({
            'projectId': id,
            'shot': s.get('shot', 0),
            'scene': s.get('scene', 0),
            'beats': json.dumps(beats) if isinstance(beats, list) else str(beats),
            'loc': s.get('loc', ''),
            'subs': json.dumps(subs) if isinstance(subs, list) else str(subs),
            'frames': s.get('frames', 0),
            'duration': s.get('duration', 0),
            'camera': s.get('camera', ''),
            'action': s.get('action', ''),
            'dialogue': s.get('dialogue', ''),
            'note': s.get('note', ''),
            'prompt': s.get('prompt', ''),
        })
    return {"status": "success", "count": len(shots)}


@router.delete("/{id}/shotlist")
async def delete_shotlist(id: str, db: Any = Depends(get_db)):
    await db.shotlist.delete_many(where={'projectId': id})
    return {"status": "success"}


@router.post("/{id}/shotlist/generate-prompt")
async def generate_shot_prompt(id: str, payload: dict, db: Any = Depends(get_db)):
    system_prompt = await get_system_prompt(db, "Generate Prompt")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Generate Prompt'."}
    try:
        shot = payload
        user_content = (
            f"Generate a detailed video generation prompt for this shot:\n\n"
            f"Shot #{shot.get('shot', 0)} | Scene {shot.get('scene', 0)} | Beats: {shot.get('beats', [])}\n"
            f"Location: {shot.get('loc', '')}\n"
            f"Subjects: {shot.get('subs', '')}\n"
            f"Camera: {shot.get('camera', '')}\n"
            f"Action: {shot.get('action', '')}\n"
            f"Dialogue: {shot.get('dialogue', '')}\n"
            f"Duration: {shot.get('duration', 0)}s | Frames: {shot.get('frames', 0)}\n"
            f"Note: {shot.get('note', '')}"
        )
        result = await call_llm(db, system_prompt, user_content)
        return {"status": "success", "prompt": result}
    except Exception as e:
        return {"status": "error", "details": str(e)}
