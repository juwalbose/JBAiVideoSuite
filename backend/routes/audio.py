import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form
from typing import Any
from database import get_db
from paths import AUDIO_DIR

router = APIRouter(prefix="/projects", tags=["AudioAssets"])


@router.get("/{id}/audio")
async def get_audio(id: str, episode: int = 1, db: Any = Depends(get_db)):
    items = await db.audioasset.find_many(where={'projectId': id, 'episode': episode})
    return {"status": "success", "audio": [a.dict() for a in items]}


@router.post("/{id}/audio")
async def import_audio(
    id: str,
    file: UploadFile = File(...),
    name: str = Form(...),
    audio_type: str = Form(...),
    transcript: str = Form(""),
    episode: int = 1,
    db: Any = Depends(get_db),
):
    os.makedirs(AUDIO_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "audio.mp3")[1]
    safe_name = "".join(c for c in name if c.isalnum() or c in " _-").strip().replace(" ", "_")
    filename = f"{safe_name}{ext}"
    dest = os.path.join(AUDIO_DIR, filename)
    try:
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        audio_path = f"/assets/audio/{filename}"
        await db.audioasset.create({
            'projectId': id,
            'episode': episode,
            'name': name,
            'audioPath': audio_path,
            'audioType': audio_type,
            'transcript': transcript,
        })
    except Exception:
        if os.path.exists(dest):
            os.unlink(dest)
        raise
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
        # Delete the physical file if it exists
        if item.audioPath:
            filename = os.path.basename(item.audioPath)
            file_path = os.path.join(AUDIO_DIR, filename)
            if os.path.exists(file_path):
                os.unlink(file_path)
        await db.audioasset.delete(where={'id': audio_id})
        return {"status": "success"}
    except Exception as e:
        print(f"DEBUG: Error in delete_audio: {e}")
        return {"status": "error", "details": str(e)}
