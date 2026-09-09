from fastapi import APIRouter
import os

router = APIRouter(prefix="/gallery", tags=["Gallery"])

# Path to the generated images folder relative to the backend directory
# Since main.py is inside 'backend/', we go up one level (..) to find 'assets'
GENERATED_IMAGES_DIR = "../assets/generated"

@router.get("/")
async def get_gallery():
    """Returns a list of full paths for all image files in the assets/generated folder."""
    # Ensure the directory exists relative to this file or the backend root
    if not os.path.exists(GENERATED_IMAGES_DIR):
        os.makedirs(GENERATED_IMAGES_DIR, exist_ok=True)
    
    valid_extensions = ('.png', '.jpg', '.jpeg', '.webp')
    images = [
        f"/assets/generated/{f}" 
        for f in os.listdir(GENERATED_IMAGES_DIR) 
        if f.lower().endswith(valid_extensions)
    ]
    # Sort alphabetically
    images.sort()
    return {"images": images}
