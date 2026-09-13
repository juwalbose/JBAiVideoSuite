from fastapi import APIRouter, Query, File, HTTPException, UploadFile
from pydantic import BaseModel
import httpx
from database import db

router = APIRouter(prefix="/comfyui", tags=["ComfyUI"])

class ComfyUIStatus(BaseModel):
    available: bool
    url: str
    vram_free_mb: float | None = None
    cuda_device: str | None = None
    details: str

@router.get("/check", response_model=ComfyUIStatus)
async def check_comfyui(host: str = Query("127.0.0.1"), port: int = Query(8188)):
    target_url = f"http://{host}:{port}"
    timeout = httpx.Timeout(3.0, connect=2.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            # /system_stats is native to ComfyUI and returns hardware stats
            response = await client.get(f"{target_url}/system_stats")
            
            if response.status_code == 200:
                data = response.json()
                devices = data.get("devices", [])
                
                vram_free = None
                device_name = None
                if devices:
                    # ComfyUI reports VRAM in bytes
                    vram_free = round(devices[0].get("vram_free", 0) / (1024 * 1024), 2)
                    device_name = devices[0].get("name", "Unknown GPU/CPU")

                return ComfyUIStatus(
                    available=True,
                    url=target_url,
                    vram_free_mb=vram_free,
                    cuda_device=device_name,
                    details="ComfyUI server is reachable and responsive."
                )
            else:
                return ComfyUIStatus(
                    available=False,
                    url=target_url,
                    details=f"Server reachable, but returned HTTP {response.status_code}."
                )

        except (httpx.ConnectError, httpx.ConnectTimeout):
            return ComfyUIStatus(
                available=False,
                url=target_url,
                details=f"Failed to connect to ComfyUI at {target_url}. Ensure it is running and listening."
            )
        except Exception as e:
            return ComfyUIStatus(
                available=False,
                url=target_url,
                details=f"Error checking ComfyUI: {str(e)}"
            )

@router.post("/upload")
async def upload_to_comfy(file: UploadFile = File(...)):
    print(f"Backend received upload request for file: {file.filename}")
    # Fetch comfyui settings from DB
    comfyui = await db.comfyuisettings.find_first()
    if not comfyui:
        raise HTTPException(status_code=500, detail="ComfyUI settings not found in database.")

    # Accessing fields using dot notation for Prisma Model objects
    host = comfyui.ip
    port = comfyui.port
    target_url = f"http://{host}:{port}"

    # Read binary bytes sent from React
    file_bytes = await file.read()

    # ComfyUI strictly expects multipart form key named "image"
    files = {
        "image": (
            file.filename,
            file_bytes,
            file.content_type or "image/png",
        )
    }
    data = {"overwrite": "true"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.post(
                f"{target_url}/upload/image", files=files, data=data
            )
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail="ComfyUI is unreachable. Check if it is running.",
            )

        if res.status_code != 200:
            raise HTTPException(
                status_code=res.status_code,
                detail=f"ComfyUI rejected upload: {res.text}",
            )

        # Returns: {"name": "my_image.png", "subfolder": "", "type": "input"}
        return res.json()