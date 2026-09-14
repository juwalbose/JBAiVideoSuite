import json
import re
from fastapi import APIRouter, Depends
from typing import Any
from database import get_db
from routes.llm_helper import get_system_prompt, call_llm

router = APIRouter(prefix="/projects", tags=["ShotList"])


@router.get("/{id}/shotlist")
async def get_shotlist(id: str, db: Any = Depends(get_db)):
    shots = await db.shotlist.find_many(where={'projectId': id})
    shots.sort(key=lambda s: s.shot)
    return [s.dict() for s in shots]


@router.post("/{id}/shotlist")
async def save_shotlist(id: str, payload: dict, db: Any = Depends(get_db)):
    shots = payload.get('shots', [])
    await db.shotlist.delete_many(where={'projectId': id})
    for s in shots:
        beats = s.get('beats', [])
        subs = s.get('subs', '')
        if isinstance(subs, str) and ',' in subs:
            subs = [x.strip() for x in subs.split(',') if x.strip()]
        char_ids = [x for x in s.get('characterAssetIds', []) if x]
        char_states = [x for x in s.get('characterStateIds', []) if x]
        prop_ids = [x for x in s.get('propAssetIds', []) if x]
        prop_states = [x for x in s.get('propStateIds', []) if x]
        await db.shotlist.create({
            'projectId': id,
            'shot': s.get('shot', 0),
            'scene': s.get('scene', 0),
            'beats': json.dumps(beats) if isinstance(beats, list) else str(beats),
            'loc': s.get('loc', ''),
            'subs': json.dumps(subs) if isinstance(subs, list) else str(subs),
            'frames': s.get('frames', 0),
            'duration': s.get('duration', 0),
            'camera': s.get('camera', ''),
            'action': s.get('action', ''),
            'dialogue': s.get('dialogue', ''),
            'note': s.get('note', ''),
            'prompt': s.get('prompt', ''),
            'locationAssetId': s.get('locationAssetId') or None,
            'locationStateId': s.get('locationStateId') or None,
            'characterAssetIds': json.dumps(char_ids) if char_ids else None,
            'characterStateIds': json.dumps(char_states) if char_states else None,
            'propAssetIds': json.dumps(prop_ids) if prop_ids else None,
            'propStateIds': json.dumps(prop_states) if prop_states else None,
        })
    return {"status": "success", "count": len(shots)}


@router.delete("/{id}/shotlist")
async def delete_shotlist(id: str, db: Any = Depends(get_db)):
    await db.shotlist.delete_many(where={'projectId': id})
    return {"status": "success"}


def extract_scene(script: str, scene_num: int) -> str:
    pattern = rf'(## Scene {scene_num}:\s*.+?)(?=\n## Scene |\Z)'
    match = re.search(pattern, script, re.DOTALL)
    return match.group(1).strip() if match else ''


def get_state_desc(asset, state_id: str | None) -> str:
    """Build description from asset + specific state."""
    parts = [asset.description or '']
    if state_id:
        for state in (asset.states or []):
            if state.id == state_id and state.description:
                parts.append(state.description)
                break
    return ' '.join(p for p in parts if p).strip()


@router.post("/{id}/shotlist/generate-prompt")
async def generate_shot_prompt(id: str, payload: dict, db: Any = Depends(get_db)):
    system_prompt = await get_system_prompt(db, "Generate Video Prompt")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Generate Video Prompt'."}
    try:
        shot = payload
        scene_num = shot.get('scene', 0)
        beats = shot.get('beats', [])
        if isinstance(beats, str):
            beats = json.loads(beats) if beats.startswith('[') else [int(x) for x in beats.replace('[]', '').split(',') if x.strip()]

        script = await db.script.find_first(where={'projectId': id})
        scene_text = extract_scene(script.content, scene_num) if script else ''

        beat_list = ', '.join(str(b) for b in beats) if beats else 'unknown'

        asset_lines = []
        loc_id = shot.get('locationAssetId')
        loc_state = shot.get('locationStateId')
        if loc_id:
            loc = await db.asset.find_first(where={'id': loc_id, 'projectId': id})
            if loc:
                asset_lines.append(f"- Location: {loc.name} — {get_state_desc(loc, loc_state)}")

        char_ids = shot.get('characterAssetIds', [])
        char_states = shot.get('characterStateIds', [])
        if isinstance(char_ids, str):
            char_ids = json.loads(char_ids) if char_ids.startswith('[') else []
        if isinstance(char_states, str):
            char_states = json.loads(char_states) if char_states.startswith('[') else []
        for i, cid in enumerate(char_ids):
            if not cid:
                continue
            ch = await db.asset.find_first(where={'id': cid, 'projectId': id})
            if ch:
                state_id = char_states[i] if i < len(char_states) else None
                asset_lines.append(f"- Character: {ch.name} — {get_state_desc(ch, state_id)}")

        prop_ids = shot.get('propAssetIds', [])
        prop_states = shot.get('propStateIds', [])
        if isinstance(prop_ids, str):
            prop_ids = json.loads(prop_ids) if prop_ids.startswith('[') else []
        if isinstance(prop_states, str):
            prop_states = json.loads(prop_states) if prop_states.startswith('[') else []
        for i, pid in enumerate(prop_ids):
            if not pid:
                continue
            pr = await db.asset.find_first(where={'id': pid, 'projectId': id})
            if pr:
                state_id = prop_states[i] if i < len(prop_states) else None
                asset_lines.append(f"- Prop: {pr.name} — {get_state_desc(pr, state_id)}")

        parts = []
        if scene_text:
            parts.append(f"Full Scene:\n{scene_text}")
        parts.append(f"Target: Beat {beat_list}")
        parts.append(
            f"Shot Details:\n"
            f"- Camera: {shot.get('camera', '')}\n"
            f"- Action: {shot.get('action', '')}\n"
            f"- Dialogue: {shot.get('dialogue', '')}\n"
            f"- Duration: {shot.get('duration', 0)}s"
        )
        if asset_lines:
            parts.append("Reference Assets:\n" + '\n'.join(asset_lines))

        user_content = '\n\n'.join(parts)
        result = await call_llm(db, system_prompt, user_content)
        return {"status": "success", "prompt": result}
    except Exception as e:
        return {"status": "error", "details": str(e)}
