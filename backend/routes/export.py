from fastapi import APIRouter, Depends, UploadFile, File
from typing import Any
from database import get_db
import os
import json
import uuid

router = APIRouter(prefix="/export", tags=["Export"])

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PROMPTS_DIR = os.path.join(ROOT_DIR, "assets", "systemprompts")
WORKFLOWS_DIR = os.path.join(ROOT_DIR, "assets", "workflows")


def _dict_or_none(obj):
    if obj is None:
        return None
    return obj.dict()


@router.get("/project/{id}")
async def export_project(id: str, include_settings: bool = True, db: Any = Depends(get_db)):
    """Export a project. Optionally include global settings/mappings/prompts/workflows."""
    project = await db.project.find_first(
        where={'id': id},
        include={
            'stories': True,
            'scripts': True,
            'shotList': True,
            'assets': {'where': {}, 'include': {'states': True}},
            'audioAssets': True,
            'finalVideo': True,
        }
    )
    if not project:
        return {"status": "error", "details": "Project not found"}

    d = project.dict()

    # Flatten relations into clean arrays
    stories = d.pop('stories', [])
    scripts = d.pop('scripts', [])
    shot_list = d.pop('shotList', [])
    assets = d.pop('assets', [])
    audio_assets = d.pop('audioAssets', [])
    final_video = d.pop('finalVideo', None)
    d.pop('beats', None)

    result = {
        "version": 1,
        "project": d,
        "stories": stories,
        "scripts": scripts,
        "shotLists": shot_list,
        "assets": assets,
        "audioAssets": audio_assets,
        "finalVideo": final_video,
    }

    if include_settings:
        llm = await db.llmsettings.find_first()
        backend = await db.backendsettings.find_first()
        comfyui = await db.comfyuisettings.find_first()
        app_mappings = await db.appactionmapping.find_many()
        comfy_mappings = await db.comfyworkflowmapping.find_many()

        prompts = {}
        if os.path.isdir(PROMPTS_DIR):
            for f in os.listdir(PROMPTS_DIR):
                if f.endswith('.txt'):
                    with open(os.path.join(PROMPTS_DIR, f), 'r', encoding='utf-8') as fh:
                        prompts[f] = fh.read()

        workflows = {}
        if os.path.isdir(WORKFLOWS_DIR):
            for f in os.listdir(WORKFLOWS_DIR):
                if f.endswith('.json'):
                    with open(os.path.join(WORKFLOWS_DIR, f), 'r', encoding='utf-8') as fh:
                        workflows[f] = fh.read()

        result["settings"] = {
            "llm": _dict_or_none(llm),
            "backend": _dict_or_none(backend),
            "comfyui": _dict_or_none(comfyui),
        }
        result["appActionMappings"] = [m.dict() for m in app_mappings]
        result["comfyWorkflowMappings"] = [m.dict() for m in comfy_mappings]
        result["systemPrompts"] = prompts
        result["workflows"] = workflows

    return {"status": "success", "data": result}


@router.post("/import")
async def import_project(payload: dict, db: Any = Depends(get_db)):
    """Import a project from exported JSON. Creates new IDs, remaps FKs."""
    data = payload.get('data', payload)
    if not data:
        return {"status": "error", "details": "No data provided"}

    proj = data.get('project', {})
    if not proj:
        return {"status": "error", "details": "No project in export"}

    # Generate new project ID
    new_project_id = str(uuid.uuid4())

    # Create project (strip old id, set new)
    proj_data = {
        'id': new_project_id,
        'name': proj.get('name', 'Imported Project'),
        'type': proj.get('type', 'single'),
        'duration': proj.get('duration', 120),
        'episodeCount': proj.get('episodeCount', 1),
    }
    await db.project.create(data=proj_data)

    # Import stories
    story_id_map = {}
    for s in data.get('stories', []):
        new_id = str(uuid.uuid4())
        story_id_map[s.get('id')] = new_id
        await db.story.create({
            'id': new_id,
            'projectId': new_project_id,
            'episode': s.get('episode', 1),
            'narrativeArc': s.get('narrativeArc', ''),
            'rawInput': s.get('rawInput', ''),
        })

    # Import scripts
    for s in data.get('scripts', []):
        await db.script.create({
            'id': str(uuid.uuid4()),
            'projectId': new_project_id,
            'episode': s.get('episode', 1),
            'content': s.get('content', ''),
        })

    # Import shot lists
    for s in data.get('shotLists', []):
        await db.shotlist.create({
            'id': str(uuid.uuid4()),
            'projectId': new_project_id,
            'episode': s.get('episode', 1),
            'shot': s.get('shot', 0),
            'scene': s.get('scene', 0),
            'beats': s.get('beats', '[]'),
            'loc': s.get('loc', ''),
            'subs': s.get('subs', ''),
            'frames': s.get('frames', 0),
            'duration': s.get('duration', 0),
            'camera': s.get('camera', ''),
            'action': s.get('action', ''),
            'dialogue': s.get('dialogue', ''),
            'note': s.get('note', ''),
            'prompt': s.get('prompt', ''),
            'locationAssetId': s.get('locationAssetId'),
            'locationStateId': s.get('locationStateId'),
            'characterAssetIds': s.get('characterAssetIds'),
            'characterStateIds': s.get('characterStateIds'),
            'propAssetIds': s.get('propAssetIds'),
            'propStateIds': s.get('propStateIds'),
            'sceneDialogAudioId': s.get('sceneDialogAudioId'),
            'characterAudioIds': s.get('characterAudioIds'),
            'characterAudioTypes': s.get('characterAudioTypes'),
            'musicOn': s.get('musicOn', False),
            'musicDesc': s.get('musicDesc', ''),
            'videoPath': s.get('videoPath'),
        })

    # Import assets (with states) — build ID maps for FK remapping
    asset_id_map = {}
    state_id_map = {}
    for a in data.get('assets', []):
        new_asset_id = str(uuid.uuid4())
        asset_id_map[a.get('id')] = new_asset_id
        await db.asset.create({
            'id': new_asset_id,
            'projectId': new_project_id,
            'episode': a.get('episode', 1),
            'beatId': None,
            'type': a.get('type', 'CHARACTER'),
            'name': a.get('name', ''),
            'description': a.get('description'),
            'imagePath': a.get('imagePath'),
            'prompt': a.get('prompt'),
        })
        for st in a.get('states', []):
            new_state_id = str(uuid.uuid4())
            state_id_map[st.get('id')] = new_state_id
            await db.assetstate.create({
                'id': new_state_id,
                'assetId': new_asset_id,
                'name': st.get('name', ''),
                'description': st.get('description'),
                'prompt': st.get('prompt'),
                'imagePath': st.get('imagePath'),
                'characterSheet': st.get('characterSheet'),
                'scenes': st.get('scenes'),
            })

    # Remap shot list FKs to new asset/state IDs
    for s in data.get('shotLists', []):
        old_loc_asset = s.get('locationAssetId')
        old_loc_state = s.get('locationStateId')
        new_loc_asset = asset_id_map.get(old_loc_asset) if old_loc_asset else None
        new_loc_state = state_id_map.get(old_loc_state) if old_loc_state else None

        char_assets = s.get('characterAssetIds')
        char_states = s.get('characterStateIds')
        prop_assets = s.get('propAssetIds')
        prop_states = s.get('propStateIds')

        def remap_json_arr(val, asset_map, state_map):
            if not val:
                return val
            try:
                arr = json.loads(val) if isinstance(val, str) else val
                if asset_map is not None:
                    return json.dumps([asset_map.get(x, x) for x in arr])
                return json.dumps([state_map.get(x, x) for x in arr])
            except Exception:
                return val

        updates = {}
        if new_loc_asset:
            updates['locationAssetId'] = new_loc_asset
        if new_loc_state:
            updates['locationStateId'] = new_loc_state
        if char_assets:
            updates['characterAssetIds'] = remap_json_arr(char_assets, asset_id_map, None)
        if char_states:
            updates['characterStateIds'] = remap_json_arr(char_states, None, state_id_map)
        if prop_assets:
            updates['propAssetIds'] = remap_json_arr(prop_assets, asset_id_map, None)
        if prop_states:
            updates['propStateIds'] = remap_json_arr(prop_states, None, state_id_map)

        if updates:
            # Find the shot list entry we just created (match by shot number + episode)
            sl = await db.shotlist.find_first({
                'projectId': new_project_id,
                'episode': s.get('episode', 1),
                'shot': s.get('shot', 0),
            })
            if sl:
                await db.shotlist.update(where={'id': sl.id}, data=updates)

    # Remap audio FKs in shot lists
    audio_id_map = {}
    for a in data.get('audioAssets', []):
        new_audio_id = str(uuid.uuid4())
        audio_id_map[a.get('id')] = new_audio_id
        await db.audioasset.create({
            'id': new_audio_id,
            'projectId': new_project_id,
            'episode': a.get('episode', 1),
            'name': a.get('name', ''),
            'audioPath': a.get('audioPath', ''),
            'audioType': a.get('audioType', 'SCENE_DIALOG'),
            'transcript': a.get('transcript', ''),
        })

    # Remap audio IDs in shot lists
    for s in data.get('shotLists', []):
        updates = {}
        old_scene_audio = s.get('sceneDialogAudioId')
        if old_scene_audio and old_scene_audio in audio_id_map:
            updates['sceneDialogAudioId'] = audio_id_map[old_scene_audio]
        char_audios = s.get('characterAudioIds')
        if char_audios:
            try:
                arr = json.loads(char_audios) if isinstance(char_audios, str) else char_audios
                updates['characterAudioIds'] = json.dumps([audio_id_map.get(x, x) for x in arr])
            except Exception:
                pass
        if updates:
            sl = await db.shotlist.find_first({
                'projectId': new_project_id,
                'episode': s.get('episode', 1),
                'shot': s.get('shot', 0),
            })
            if sl:
                await db.shotlist.update(where={'id': sl.id}, data=updates)

    # Import final video
    fv = data.get('finalVideo')
    if fv:
        await db.finalvideo.create({
            'id': str(uuid.uuid4()),
            'projectId': new_project_id,
            'totalDuration': fv.get('totalDuration'),
            'exportPath': fv.get('exportPath'),
            'thumbnailUrl': fv.get('thumbnailUrl'),
        })

    # Import settings (upsert)
    settings = data.get('settings', {})
    if settings.get('llm'):
        llm = await db.llmsettings.find_first()
        ld = settings['llm']
        if llm:
            await db.llmsettings.update(where={'id': llm.id}, data={
                'ip': ld.get('ip'), 'port': ld.get('port'),
                'modelName': ld.get('modelName'), 'temperature': ld.get('temperature'),
                'maxTokens': ld.get('maxTokens'),
            })
        else:
            await db.llmsettings.create({
                'ip': ld.get('ip'), 'port': ld.get('port'),
                'modelName': ld.get('modelName'), 'temperature': ld.get('temperature'),
                'maxTokens': ld.get('maxTokens'),
            })
    if settings.get('backend'):
        backend = await db.backendsettings.find_first()
        bd = settings['backend']
        if backend:
            await db.backendsettings.update(where={'id': backend.id}, data={
                'apiUrl': bd.get('apiUrl'), 'dbPath': bd.get('dbPath'),
            })
        else:
            await db.backendsettings.create({
                'apiUrl': bd.get('apiUrl'), 'dbPath': bd.get('dbPath'),
            })
    if settings.get('comfyui'):
        comfy = await db.comfyuisettings.find_first()
        cd = settings['comfyui']
        if comfy:
            await db.comfyuisettings.update(where={'id': comfy.id}, data={
                'ip': cd.get('ip'), 'port': cd.get('port'),
                'deviceId': cd.get('deviceId'), 'pollInterval': cd.get('pollInterval'),
            })
        else:
            await db.comfyuisettings.create({
                'ip': cd.get('ip'), 'port': cd.get('port'),
                'deviceId': cd.get('deviceId'), 'pollInterval': cd.get('pollInterval'),
            })

    # Import app action mappings (upsert by action)
    for m in data.get('appActionMappings', []):
        existing = await db.appactionmapping.find_first(where={'action': m.get('action')})
        if existing:
            await db.appactionmapping.update(where={'id': existing.id}, data={
                'promptFile': m.get('promptFile'),
            })
        else:
            await db.appactionmapping.create({
                'action': m.get('action'),
                'promptFile': m.get('promptFile'),
            })

    # Import comfy workflow mappings (upsert by action)
    for m in data.get('comfyWorkflowMappings', []):
        existing = await db.comfyworkflowmapping.find_first(where={'action': m.get('action')})
        if existing:
            await db.comfyworkflowmapping.update(where={'id': existing.id}, data={
                'workflowFile': m.get('workflowFile'),
                'resolutionJson': m.get('resolutionJson'),
            })
        else:
            await db.comfyworkflowmapping.create({
                'action': m.get('action'),
                'workflowFile': m.get('workflowFile'),
                'resolutionJson': m.get('resolutionJson'),
            })

    # Import system prompts (write files)
    for filename, content in data.get('systemPrompts', {}).items():
        filepath = os.path.join(PROMPTS_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    # Import workflows (write files)
    for filename, content in data.get('workflows', {}).items():
        filepath = os.path.join(WORKFLOWS_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return {"status": "success", "projectId": new_project_id}
