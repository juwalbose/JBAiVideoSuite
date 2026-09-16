import os
import json
import uuid
import httpx
from fastapi import APIRouter, Depends
from typing import Any, Dict

from database import get_db
from paths import WORKFLOWS_DIR, GENERATED_DIR, ASSETS_DIR

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

    workflow_path = os.path.join(WORKFLOWS_DIR, wf_mapping.workflowFile)
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

    comfyui = await db.comfyuisettings.find_first()
    if not comfyui:
        return {"status": "error", "details": "ComfyUI settings not found"}

    comfy_http = f"http://{comfyui.ip}:{comfyui.port}"
    task_id = str(uuid.uuid4())

    # M4: upload images and audio to ComfyUI's input/ folder BEFORE injecting
    # so ComfyUI can actually find them.
    assets_dir = ASSETS_DIR

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Upload images
        for i, rel_path in enumerate(image_files):
            local_path = os.path.join(assets_dir, rel_path)
            if not os.path.exists(local_path):
                print(f"[VideoGen] image not found locally: {local_path}")
                continue
            with open(local_path, "rb") as f:
                file_bytes = f.read()
            filename = os.path.basename(rel_path)
            files = {"image": (filename, file_bytes, "image/png")}
            data = {"overwrite": "true"}
            try:
                upload_res = await client.post(f"{comfy_http}/upload/image", files=files, data=data)
                if upload_res.status_code == 200:
                    uploaded_name = upload_res.json().get("name", filename)
                    image_files[i] = uploaded_name
                else:
                    print(f"[VideoGen] upload failed for {filename}: {upload_res.text}")
            except Exception as e:
                print(f"[VideoGen] upload error for {filename}: {e}")

        # Upload audio
        for i, rel_path in enumerate(audio_files):
            local_path = os.path.join(assets_dir, rel_path)
            if not os.path.exists(local_path):
                print(f"[VideoGen] audio not found locally: {local_path}")
                continue
            with open(local_path, "rb") as f:
                file_bytes = f.read()
            filename = os.path.basename(rel_path)
            files = {"image": (filename, file_bytes, "audio/mpeg")}
            data = {"overwrite": "true"}
            try:
                upload_res = await client.post(f"{comfy_http}/upload/image", files=files, data=data)
                if upload_res.status_code == 200:
                    uploaded_name = upload_res.json().get("name", filename)
                    audio_files[i] = uploaded_name
                else:
                    print(f"[VideoGen] audio upload failed for {filename}: {upload_res.text}")
            except Exception as e:
                print(f"[VideoGen] audio upload error for {filename}: {e}")

    # Inject inputs into workflow nodes (case-insensitive role matching)
    img_idx = 0
    aud_idx = 0
    provided_img_nodes = set()
    provided_aud_nodes = set()
    for node_id, node_data in workflow_data.items():
        if not isinstance(node_data, dict):
            continue
        title = node_data.get('_meta', {}).get('title', '').lower()
        inputs = node_data.setdefault('inputs', {})

        if '(input:prompt)' in title:
            inputs['value'] = prompt
        elif '(input:seed)' in title:
            inputs['value'] = seed
        elif '(input:width)' in title:
            inputs['value'] = w
        elif '(input:height)' in title:
            inputs['value'] = h
        elif '(input:duration)' in title:
            inputs['value'] = shot.duration
        elif '(input:image)' in title:
            if img_idx < len(image_files):
                inputs['image'] = image_files[img_idx]
                provided_img_nodes.add(node_id)
                img_idx += 1
        elif '(input:audio)' in title:
            if aud_idx < len(audio_files):
                inputs['audio'] = audio_files[aud_idx]
                provided_aud_nodes.add(node_id)
                aud_idx += 1

    # Prune unused image/audio input nodes
    to_remove = []
    for nid, ndata in workflow_data.items():
        if not isinstance(ndata, dict):
            continue
        title = ndata.get('_meta', {}).get('title', '').lower()
        if '(input:image)' in title and nid not in provided_img_nodes:
            to_remove.append(nid)
        elif '(input:audio)' in title and nid not in provided_aud_nodes:
            to_remove.append(nid)
    for nid in to_remove:
        del workflow_data[nid]
    if to_remove:
        print(f"[VideoGen] pruned {len(to_remove)} unused input node(s): {to_remove}")

    print(f"\n--- VideoGen Workflow ({wf_mapping.workflowFile}) ---")
    print(json.dumps(workflow_data, indent=2))
    print("-----------------------------------------------\n")

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
        entry = history_data.get(prompt_id, {})
        outputs = entry.get("outputs", {})

        # M1: check for ComfyUI errors before assuming pending
        status_info = entry.get("status", {})
        if status_info.get("status") == "error":
            detail = status_info.get("message", "ComfyUI generation failed")
            video_tasks.pop(task_id, None)
            return {"status": "error", "details": detail, "task_id": task_id}

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

        # M2: save with a stable name (task_id) instead of ComfyUI's counter name
        os.makedirs(GENERATED_DIR, exist_ok=True)
        gen_dir = GENERATED_DIR
        ext = os.path.splitext(output_info["filename"])[1] or ".mp4"
        stable_name = f"{task_id}{ext}"
        save_path = os.path.join(gen_dir, stable_name)
        with open(save_path, "wb") as f:
            f.write(file_res.content)

        video_path = f"/assets/generated/{stable_name}"

        if info["resolution"] == "high":
            shot = await db.shotlist.find_first(
                where={'projectId': info["project_id"], 'episode': info.get("episode", 1), 'shot': info["shot_num"]}
            )
            if shot:
                await db.shotlist.update(where={'id': shot.id}, data={'videoPath': video_path})

        video_tasks.pop(task_id, None)
        print(f"[VideoGen] task_id={task_id} -> COMPLETE ({output_info['filename']}) res={info['resolution']}")

        return {
            "status": "complete",
            "task_id": task_id,
            "videoPath": video_path,
            "filename": output_info["filename"],
        }
