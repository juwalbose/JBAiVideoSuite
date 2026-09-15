from fastapi import APIRouter, Depends
from typing import Any
import os
import base64

from database import get_db

router = APIRouter(prefix="/gallery", tags=["Gallery"])

# Path to the generated images folder relative to the backend directory
# Since main.py is inside 'backend/', we go up one level (..) to find 'assets'
GENERATED_IMAGES_DIR = "../assets/generated"

@router.get("/")
async def get_gallery():
    """Returns a list of full paths for all image files in the assets/generated folder."""
    if not os.path.exists(GENERATED_IMAGES_DIR):
        os.makedirs(GENERATED_IMAGES_DIR, exist_ok=True)
    
    image_extensions = ('.png', '.jpg', '.jpeg', '.webp')
    video_extensions = ('.mp4', '.webm')
    all_extensions = image_extensions + video_extensions
    items = []
    for f in os.listdir(GENERATED_IMAGES_DIR):
        if f.lower().endswith(all_extensions):
            ftype = "video" if f.lower().endswith(video_extensions) else "image"
            items.append({"path": f"/assets/generated/{f}", "type": ftype})
    items.sort(key=lambda x: x["path"])
    return {"images": [item["path"] for item in items], "types": {item["path"]: item["type"] for item in items}}

@router.post("/upload")
async def upload_image(payload: dict):
    """Receives a base64-encoded image and writes it to the assets/generated folder."""
    filename = payload.get("filename", "upload.png")
    data_url = payload.get("data", "")
    if not data_url:
        return {"status": "error", "details": "Missing image data"}
    # Strip data URL prefix (e.g. "data:image/png;base64,")
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    if not os.path.exists(GENERATED_IMAGES_DIR):
        os.makedirs(GENERATED_IMAGES_DIR, exist_ok=True)
    dest = os.path.join(GENERATED_IMAGES_DIR, filename)
    with open(dest, "wb") as out:
        out.write(base64.b64decode(data_url))
    return {"status": "success", "path": f"/assets/generated/{filename}"}

@router.delete("/{filename}")
async def delete_image(filename: str):
    """Deletes an image file from the assets/generated folder."""
    filepath = os.path.join(GENERATED_IMAGES_DIR, filename)
    if not os.path.exists(filepath):
        return {"status": "error", "details": "File not found"}
    try:
        os.remove(filepath)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "details": str(e)}

@router.post("/assign")
async def assign_image(payload: dict, db: Any = Depends(get_db)):
    """Assigns an image path to an asset state's imagePath or characterSheet field."""
    asset_id = payload.get('assetId')
    state_id = payload.get('stateId')
    image_path = payload.get('imagePath')
    field = payload.get('field')  # 'imagePath' or 'characterSheet'
    
    if not asset_id or not state_id or not image_path or not field:
        return {"status": "error", "details": "Missing required fields"}
    
    if field not in ('imagePath', 'characterSheet'):
        return {"status": "error", "details": "Invalid field"}
    
    try:
        await db.assetstate.update(where={'id': state_id}, data={field: image_path})
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "details": str(e)}
