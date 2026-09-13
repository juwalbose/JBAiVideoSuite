from fastapi import APIRouter, Depends
from typing import Any, Optional
from pydantic import BaseModel
from database import get_db

router = APIRouter(prefix="/appsettings", tags=["AppSettings"])

APP_ACTIONS = [
    "Develop Raw Story",
    "Extract Cast",
    "Generate Script",
    "Refine Dialog",
    "Generate Shots",
]

class MappingUpdate(BaseModel):
    action: str
    promptFile: Optional[str] = None

@router.get("/")
async def get_mappings(db: Any = Depends(get_db)):
    mappings = await db.appactionmapping.find_many()
    result = {}
    for m in mappings:
        result[m.action] = m.promptFile
    # Fill in any actions that have no mapping yet
    for action in APP_ACTIONS:
        if action not in result:
            result[action] = None
    return result

@router.post("/save")
async def save_mapping(update: MappingUpdate, db: Any = Depends(get_db)):
    existing = await db.appactionmapping.find_first(where={'action': update.action})
    if existing:
        await db.appactionmapping.update(
            data={'promptFile': update.promptFile},
            where={'id': existing.id}
        )
    else:
        await db.appactionmapping.create({
            'action': update.action,
            'promptFile': update.promptFile
        })
    return {"status": "success"}
