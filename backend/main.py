import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from typing import Optional

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
from routes import settings, projects, handshake, comfyui, workflows, playground

from database import db, get_db

app = FastAPI(title="BionicProducer API")

# Middleware for CORS
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the assets directory to serve static files (images, workflows, etc.)
base_dir = os.path.dirname(os.path.abspath(__file__))
assets_dir = os.path.abspath(os.path.join(base_dir, "..", "assets"))
print(f"DEBUG: Assets directory mounted at: {assets_dir}")
app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

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
            "ip": "192.168.1.66",
            "port": 1234,
            "modelName": "gemma-4-e4b-uncensored-hauhaucs-aggressive",
            "temperature": 0.7,
            "maxTokens": 512,
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

# --- Root Endpoint (Optional) ---
@app.get("/")
async def root():
    return {"message": "BionicProducer API is running"}
