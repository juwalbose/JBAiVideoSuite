import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form
from typing import Any
from database import get_db

router = APIRouter(prefix="/projects", tags=["AudioAssets"])

AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "assets", "audio")


@router.get("/{id}/audio")
async def get_audio(id: str, db: Any = Depends(get_db)):
    items = await db.audioasset.find_many(where={'projectId': id})
    return {"status": "success", "audio": [a.dict() for a in items]}


@router.post("/{id}/audio")
async def import_audio(
    id: str,
    file: UploadFile = File(...),
    name: str = Form(...),
    audio_type: str = Form(...),
    transcript: str = Form(""),
    db: Any = Depends(get_db),
):
    os.makedirs(AUDIO_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "audio.mp3")[1]
    safe_name = "".join(c for c in name if c.isalnum() or c in " _-").strip().replace(" ", "_")
    filename = f"{safe_name}{ext}"
    dest = os.path.join(AUDIO_DIR, filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    audio_path = f"/assets/audio/{filename}"
    await db.audioasset.create({
        'projectId': id,
        'name': name,
        'audioPath': audio_path,
        'audioType': audio_type,
        'transcript': transcript,
    })
    return {"status": "success", "audioPath": audio_path}


@router.patch("/{id}/audio/{audio_id}")
async def update_audio(id: str, audio_id: str, payload: dict, db: Any = Depends(get_db)):
    try:
        data = {}
        for field in ('name', 'audioType', 'transcript'):
            if field in payload:
                data[field] = payload[field]
        if data:
            await db.audioasset.update(where={'id': audio_id}, data=data)
        return {"status": "success"}
    except Exception as e:
        print(f"DEBUG: Error in update_audio: {e}")
        return {"status": "error", "details": str(e)}


@router.delete("/{id}/audio/{audio_id}")
async def delete_audio(id: str, audio_id: str, db: Any = Depends(get_db)):
    try:
        item = await db.audioasset.find_first(where={'id': audio_id, 'projectId': id})
        if not item:
            return {"status": "error", "details": "Audio asset not found"}
        await db.audioasset.delete(where={'id': audio_id})
        return {"status": "success"}
    except Exception as e:
        print(f"DEBUG: Error in delete_audio: {e}")
        return {"status": "error", "details": str(e)}
