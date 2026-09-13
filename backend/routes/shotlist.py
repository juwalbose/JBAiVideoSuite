from fastapi import APIRouter, Depends
from typing import Any
from database import get_db

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
        await db.shotlist.create({
            'projectId': id,
            'shot': s.get('shot', 0),
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
