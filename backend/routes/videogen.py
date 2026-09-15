import os
import json
import uuid
import httpx
from fastapi import APIRouter, Depends, Response
from typing import Any, Dict

from database import get_db

router = APIRouter(prefix="/projects", tags=["VideoGen"])

video_tasks: Dict[str, dict] = {}

DEFAULT_VIDEO_RES = {"low": {"w": 960, "h": 544}, "high": {"w": 1920, "h": 1080}}


async def _get_video_res(db):
    m = await db.comfyworkflowmapping.find_first(where={'action': 'MinimaxH3 Ref2VA Generation'})
    if m and m.resolutionJson:
        try:
            return json.loads(m.resolutionJson)
        except Exception:
            pass
    return DEFAULT_VIDEO_RES


async def _get_asset_image(db, asset_id, state_id, asset_type):
    """Return the image filename for an asset state (without /assets/ prefix)."""
    asset = await db.asset.find_first(where={'id': asset_id}, include={'states': True})
    if not asset:
        return None
    state = None
    if state_id:
        state = next((s for s in asset.states if s.id == state_id), None)
    if not state:
        state = asset.states[0] if asset.states else None
    if not state:
        return None
    path = state.characterSheet if (asset_type == 'CHARACTER' and state.characterSheet) else state.imagePath
    if not path:
        return None
    return path.replace('/assets/', '')


async def _get_audio_filename(db, audio_id):
    audio = await db.audioasset.find_first(where={'id': audio_id})
    if not audio or not audio.audioPath:
        return None
    return audio.audioPath.replace('/assets/', '')


@router.post("/{id}/videogen/generate")
async def generate_video(id: str, payload: dict, db: Any = Depends(get_db)):
    shot_num = payload.get('shot')
    res_type = payload.get('resolution', 'low')
    seed = payload.get('seed', 0)
    prompt = payload.get('prompt', '')
    episode = payload.get('episode', 1)

    shot = await db.shotlist.find_first(where={'projectId': id, 'episode': episode, 'shot': shot_num})
    if not shot:
        return {"status": "error", "details": f"Shot {shot_num} not found"}

    wf_mapping = await db.comfyworkflowmapping.find_first(where={'action': 'MinimaxH3 Ref2VA Generation'})
    if not wf_mapping or not wf_mapping.workflowFile:
        return {"status": "error", "details": "No workflow mapped for MinimaxH3 Ref2VA Generation"}

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    workflow_path = os.path.join(base_dir, "..", "assets", "workflows", wf_mapping.workflowFile)
    if not os.path.exists(workflow_path):
        return {"status": "error", "details": f"Workflow file not found: {wf_mapping.workflowFile}"}

    with open(workflow_path, "r", encoding="utf-8") as f:
        workflow_data = json.load(f)

    res = await _get_video_res(db)
    w = res.get(res_type, {}).get('w', 960)
    h = res.get(res_type, {}).get('h', 544)

    # Collect image and audio filenames from shot's linked assets
    image_files = []
    audio_files = []

    if shot.locationAssetId:
        img = await _get_asset_image(db, shot.locationAssetId, shot.locationStateId, 'LOCATION')
        if img:
            image_files.append(img)

    char_ids = json.loads(shot.characterAssetIds) if shot.characterAssetIds else []
    char_states = json.loads(shot.characterStateIds) if shot.characterStateIds else []
    for i, cid in enumerate(char_ids):
        if not cid:
            continue
        img = await _get_asset_image(db, cid, char_states[i] if i < len(char_states) else None, 'CHARACTER')
        if img:
            image_files.append(img)

    prop_ids = json.loads(shot.propAssetIds) if shot.propAssetIds else []
    prop_states = json.loads(shot.propStateIds) if shot.propStateIds else []
    for i, pid in enumerate(prop_ids):
        if not pid:
            continue
        img = await _get_asset_image(db, pid, prop_states[i] if i < len(prop_states) else None, 'PROP')
        if img:
            image_files.append(img)

    if shot.sceneDialogAudioId:
        af = await _get_audio_filename(db, shot.sceneDialogAudioId)
        if af:
            audio_files.append(af)

    char_audio_ids = json.loads(shot.characterAudioIds) if shot.characterAudioIds else []
    for caid in char_audio_ids:
        if not caid:
            continue
        af = await _get_audio_filename(db, caid)
        if af:
            audio_files.append(af)

    # Inject inputs into workflow nodes
    img_idx = 0
    aud_idx = 0
    for node_id, node_data in workflow_data.items():
        title = node_data.get('_meta', {}).get('title', '')
        inputs = node_data.setdefault('inputs', {})

        if '(Input:prompt)' in title:
            inputs['text'] = prompt
        elif '(Input:seed)' in title:
            inputs['value'] = seed
        elif '(Input:width)' in title:
            inputs['value'] = w
        elif '(Input:height)' in title:
            inputs['value'] = h
        elif '(Input:duration)' in title:
            inputs['value'] = shot.duration
        elif '(Input:image)' in title:
            if img_idx < len(image_files):
                inputs['image'] = image_files[img_idx]
                img_idx += 1
        elif '(Input:audio)' in title:
            if aud_idx < len(audio_files):
                inputs['audio'] = audio_files[aud_idx]
                aud_idx += 1

    comfyui = await db.comfyuisettings.find_first()
    if not comfyui:
        return {"status": "error", "details": "ComfyUI settings not found"}

    comfy_http = f"http://{comfyui.ip}:{comfyui.port}"
    task_id = str(uuid.uuid4())

    async with httpx.AsyncClient(timeout=30.0) as client:
        queue_res = await client.post(f"{comfy_http}/prompt", json={"prompt": workflow_data})
        if queue_res.status_code != 200:
            return {"status": "error", "details": f"ComfyUI rejected prompt: {queue_res.text}"}
        prompt_id = queue_res.json()["prompt_id"]

    video_tasks[task_id] = {
        "prompt_id": prompt_id,
        "shot_num": shot_num,
        "resolution": res_type,
        "project_id": id,
        "episode": episode,
    }

    print(f"[VideoGen] task_id={task_id} prompt_id={prompt_id} shot={shot_num} res={res_type} "
          f"images={len(image_files)} audios={len(audio_files)}")
    return {"status": "success", "task_id": task_id}


@router.get("/{id}/videogen/status/{task_id}")
async def check_video_status(id: str, task_id: str, db: Any = Depends(get_db)):
    if task_id not in video_tasks:
        return {"status": "error", "details": "Task not found"}

    info = video_tasks[task_id]
    prompt_id = info["prompt_id"]

    comfyui = await db.comfyuisettings.find_first()
    if not comfyui:
        return {"status": "error", "details": "ComfyUI settings not found"}

    comfy_http = f"http://{comfyui.ip}:{comfyui.port}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        history_res = await client.get(f"{comfy_http}/history/{prompt_id}")
        history_data = history_res.json()
        outputs = history_data.get(prompt_id, {}).get("outputs", {})

        output_info = None
        for node_output in outputs.values():
            if "gifs" in node_output and len(node_output["gifs"]) > 0:
                output_info = node_output["gifs"][0]
                break
            if "images" in node_output and len(node_output["images"]) > 0:
                output_info = node_output["images"][0]
                break

        if not output_info:
            return {"status": "pending", "task_id": task_id}

        params = {
            "filename": output_info["filename"],
            "subfolder": output_info.get("subfolder", ""),
            "type": output_info.get("type", "output"),
        }
        file_res = await client.get(f"{comfy_http}/view", params=params)

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        gen_dir = os.path.join(base_dir, "..", "assets", "generated")
        os.makedirs(gen_dir, exist_ok=True)
        save_path = os.path.join(gen_dir, output_info["filename"])
        with open(save_path, "wb") as f:
            f.write(file_res.content)

        video_path = f"/assets/generated/{output_info['filename']}"

        if info["resolution"] == "high":
            await db.shotlist.update(
                where={'projectId': info["project_id"], 'episode': info.get("episode", 1), 'shot': info["shot_num"]},
                data={'videoPath': video_path}
            )

        video_tasks.pop(task_id, None)
        print(f"[VideoGen] task_id={task_id} -> COMPLETE ({output_info['filename']}) res={info['resolution']}")

        return Response(
            content=file_res.content,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'inline; filename="{output_info["filename"]}"',
                "X-Task-Status": "complete",
            },
        )
