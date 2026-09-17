from fastapi import FastAPI, HTTPException
from typing import Optional
from fastapi.staticfiles import StaticFiles

# Import Models
from models import (
    StoryInput, 
    StoryOutput, 
    Beat, 
    ProjectCreate, 
    LLMSettingsModel, 
    BackendSettingsModel, 
    ComfyUISettingsModel, 
    HandshakeResponse
)

# Import Routers
from routes import settings, projects, handshake, comfyui, workflows, playground, gallery, systemprompts, chat, appsettings, assets, shotlist, audio, videogen, export, takes

from database import db, get_db
from paths import ASSETS_DIR, ROOT_DIR

app = FastAPI(title="BionicProducer API", docs_url="/api-docs", redoc_url="/redoc")

# --- Static Files Mounting ---
# This allows the browser to access files in the assets folder via /assets/ path.
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# Middleware for CORS
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Startup/Shutdown Events ---

@app.on_event("startup")
async def startup():
    await db.connect()
    await initialize_settings()

async def initialize_settings():
    """Initialize default settings in the database if they don't exist."""
    llm = await db.llmsettings.find_first()
    if not llm:
        await db.llmsettings.create({
            "ip": "127.0.0.1",
            "port": 1234,
            "modelName": "",
            "temperature": 0.7,
            "maxTokens": 20000,
        })
    
    backend = await db.backendsettings.find_first()
    if not backend:
        await db.backendsettings.create({
            "apiUrl": "http://127.0.0.1:8000",
            "dbPath": "backend/prisma/database.db",
        })

    comfyui = await db.comfyuisettings.find_first()
    if not comfyui:
        await db.comfyuisettings.create({
            "ip": "127.0.0.1",
            "port": 8188,
            "deviceId": "0",
        })

@app.on_event("shutdown")
async def shutdown():
    await db.disconnect()

# --- Include Routers ---

# We use Depends(get_db) to inject the database connection into every route automatically
app.include_router(settings.router)
app.include_router(projects.router)
app.include_router(handshake.router)
app.include_router(workflows.router)
app.include_router(comfyui.router)
app.include_router(playground.router)
app.include_router(gallery.router)
app.include_router(systemprompts.router)
app.include_router(chat.router)
app.include_router(appsettings.router)
app.include_router(assets.router)
app.include_router(shotlist.router)
app.include_router(takes.router)
app.include_router(audio.router)
app.include_router(videogen.router)
app.include_router(export.router)

# --- Root Endpoint (Optional) ---
@app.get("/")
async def root():
    return {"message": "BionicProducer API is running"}

# --- Docs Endpoint ---
@app.get("/docs")
async def get_docs():
    """Serve the docs markdown file from the repo root."""
    import os
    docs_path = os.path.join(ROOT_DIR, "docs", "index.md")
    if not os.path.exists(docs_path):
        raise HTTPException(status_code=404, detail="Docs file not found")
    with open(docs_path, "r", encoding="utf-8") as f:
        content = f.read()
    # Rewrite relative image paths to absolute /docs-images/ paths
    content = content.replace("](images/", "](/docs-images/")
    return {"content": content}

@app.get("/docs-images/{filename}")
async def get_docs_image(filename: str):
    """Serve doc images from the repo docs/images folder."""
    import os
    img_path = os.path.join(ROOT_DIR, "docs", "images", filename)
    if not os.path.exists(img_path):
        raise HTTPException(status_code=404, detail="Image not found")
    from fastapi.responses import FileResponse
    return FileResponse(img_path)
