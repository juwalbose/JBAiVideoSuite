from fastapi import FastAPI
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
from routes import settings, projects, handshake, comfyui, workflows, playground, gallery, systemprompts, chat, appsettings, assets, shotlist, audio, videogen, export

from database import db, get_db

app = FastAPI(title="BionicProducer API")

# --- Static Files Mounting ---
# This allows the browser to access files in the assets folder via /assets/ path.
# Since main.py is inside the backend folder, we go up one level (..) to find assets.
app.mount("/assets", StaticFiles(directory="../assets"), name="assets")

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
app.include_router(gallery.router)
app.include_router(systemprompts.router)
app.include_router(chat.router)
app.include_router(appsettings.router)
app.include_router(assets.router)
app.include_router(shotlist.router)
app.include_router(audio.router)
app.include_router(videogen.router)
app.include_router(export.router)

# --- Root Endpoint (Optional) ---
@app.get("/")
async def root():
    return {"message": "BionicProducer API is running"}
